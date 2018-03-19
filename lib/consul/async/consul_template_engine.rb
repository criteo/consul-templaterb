require 'consul/async/utilities'
require 'consul/async/consul_endpoint'
require 'consul/async/consul_template'
require 'consul/async/consul_template_render'
require 'em-http'
require 'thread'
require 'erb'
module Consul
  module Async
    class ConsulTemplateEngine
      attr_reader :template_manager, :hot_reload_failure
      attr_writer :hot_reload_failure
      def initialize
        @templates = []
        @template_callbacks = []
        @hot_reload_failure = 'die'
        @all_templates_rendered = false
      end

      def add_template_callback(&block)
        @template_callbacks << block
      end

      def add_template(source, dest, params = {})
        @templates.push([source, dest, params])
      end

      def run(template_manager)
        @template_manager = template_manager
        EventMachine.run do
          template_renders = []
          @templates.each do |template_file, output_file, params|
            template_renders << Consul::Async::ConsulTemplateRender.new(template_manager, template_file, output_file,
                                                                        hot_reload_failure: hot_reload_failure,
                                                                        params: params)
          end
          EventMachine.add_periodic_timer(1) do
            begin
              results = template_renders.map(&:run)
              all_ready = results.reduce(true) { |a, e| a && e.ready? }
              if !@all_templates_rendered && all_ready
                @all_templates_rendered = true
                STDERR.puts "[INFO] First rendering of #{results.count} templates completed"
              end
              begin
                @template_callbacks.each do |c|
                  c.call([all_ready, template_manager, results])
                end
              rescue StandardError => cbk_error
                STDERR.puts "[ERROR] callback error: #{cbk_error.inspect}"
                raise cbk_error
              end
            rescue Consul::Async::InvalidTemplateException => e
              STDERR.puts "[FATAL]#{e}"
              template_manager.terminate
              EventMachine.stop
            rescue StandardError => e
              STDERR.puts "[ERROR] Fatal error occured: #{e.inspect} - #{e.backtrace}"
              template_manager.terminate
              EventMachine.stop
            end
          end
        end
      end
    end
  end
end
