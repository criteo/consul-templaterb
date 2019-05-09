require 'consul/async/utilities'
require 'consul/async/consul_endpoint'
require 'consul/async/vault_endpoint'
require 'consul/async/consul_template'
require 'consul/async/consul_template_render'
require 'em-http'
require 'thread'
require 'erb'
module Consul
  module Async
    class ConsulTemplateEngine
      attr_reader :template_manager, :hot_reload_failure, :template_frequency, :debug_memory
      attr_writer :hot_reload_failure, :template_frequency, :debug_memory
      def initialize
        @templates = []
        @template_callbacks = []
        @hot_reload_failure = 'die'
        @all_templates_rendered = false
        @template_frequency = 1
        @periodic_started = false
        @debug_memory = false
        @last_memory_state = build_memory_info
        @start = Time.now
      end

      def build_memory_info
        s = GC.stat
        {
          pages: s[:total_allocated_pages] - s[:total_freed_pages],
          objects: s[:total_allocated_objects] - s[:total_freed_objects],
          time: Time.now.utc
        }
      end

      def add_template_callback(&block)
        @template_callbacks << block
      end

      def add_template(source, dest, params = {})
        @templates.push([source, dest, params])
      end

      # Run templating engine once
      def do_run(template_manager, template_renders)
        results = template_renders.map(&:run)
        all_ready = results.reduce(true) { |a, e| a && e.ready? }
        if !@all_templates_rendered && all_ready
          @all_templates_rendered = true
          cur_time = Time.now
          ::Consul::Async::Debug.puts_info "First rendering of #{results.count} templates completed in #{cur_time - @start}s at #{cur_time}.  "
        end
        begin
          @template_callbacks.each do |c|
            c.call([all_ready, template_manager, results])
          end
        rescue StandardError => cbk_error
          ::Consul::Async::Debug.puts_error "callback error: #{cbk_error.inspect}"
          raise cbk_error
        end
      rescue Consul::Async::InvalidTemplateException => e
        STDERR.puts "[FATAL]#{e}"
        template_manager.terminate
        EventMachine.stop
        return 1
      rescue StandardError => e
        STDERR.puts "[FATAL] Error occured: #{e.inspect} - #{e.backtrace.join("\n\t")}"
        template_manager.terminate
        EventMachine.stop
        return 2
      end

      # Run template engine as fast as possible until first rendering occurs
      def do_run_fast(template_manager, template_renders)
        s = do_run(template_manager, template_renders)
        return s unless s.zero?

        return if @all_templates_rendered || @periodic_started
        # We continue if rendering not done and periodic not started
        EventMachine.next_tick do
          do_run_fast(template_manager, template_renders)
        end
      end

      def run(template_manager)
        result = 0
        @template_manager = template_manager
        EventMachine.run do
          template_renders = []
          @templates.each do |template_file, output_file, params|
            template_renders << Consul::Async::ConsulTemplateRender.new(template_manager, template_file, output_file,
                                                                        hot_reload_failure: hot_reload_failure,
                                                                        params: params)
          end
          # Initiate first run immediately to speed up rendering
          EventMachine.next_tick do
            result = do_run_fast(template_manager, template_renders)
          end
          EventMachine.add_periodic_timer(template_frequency) do
            @periodic_started = true
            result = do_run(template_manager, template_renders)
            if debug_memory
              GC.start
              new_memory_state = build_memory_info
              diff_allocated = new_memory_state[:pages] - @last_memory_state[:pages]
              diff_num_objects = new_memory_state[:objects] - @last_memory_state[:objects]
              if diff_allocated != 0 || diff_num_objects.abs > (@last_memory_state[:pages] / 3)
                timediff = new_memory_state[:time] - @last_memory_state[:time]
                STDERR.puts "[MEMORY] #{new_memory_state[:time]} significant RAM Usage detected\n" \
                            "[MEMORY] #{new_memory_state[:time]} Pages  : #{new_memory_state[:pages]}" \
                            " (diff #{diff_allocated} aka #{(diff_allocated / timediff).round(0)}/s) \n" \
                            "[MEMORY] #{new_memory_state[:time]} Objects: #{new_memory_state[:objects]}"\
                            " (diff #{diff_num_objects} aka #{(diff_num_objects / timediff).round(0)}/s)"
                @last_memory_state = new_memory_state
              end
            end
          end
        end
        result
      end
    end
  end
end
