require 'consul/async/utilities'
require 'em-http'
require 'thread'
require 'erb'
module Consul
  module Async
    class ConsulTemplateRenderedResult
      attr_reader :template_file, :output_file, :hot_reloaded, :ready, :modified, :last_result
      def initialize(template_file, output_file, hot_reloaded, was_success, modified, last_result)
        @template_file = template_file
        @output_file = output_file
        @hot_reloaded = hot_reloaded
        @ready = was_success
        @modified = modified
        @last_result = last_result
      end

      def ready?
        @ready
      end
    end
    class ConsulTemplateRender
      attr_reader :template_file, :output_file, :template_file_ctime, :hot_reload_failure
      def initialize(template_manager, template_file, output_file, hot_reload_failure: 'die')
        @hot_reload_failure = hot_reload_failure
        @template_file = template_file
        @output_file = output_file
        @template_manager = template_manager
        @last_result = ''
        @last_result = File.read(output_file) if File.exist? output_file
        @template = load_template
      end

      def render(tpl = @template)
        @template_manager.render(tpl, template_file)
      end

      def run
        hot_reloaded = hot_reload_if_needed
        was_success, modified, last_result = write
        ConsulTemplateRenderedResult.new(template_file, output_file, hot_reloaded, was_success, modified, last_result)
      end

      private

      def load_template
        @template_file_ctime = File.ctime(template_file)
        File.read(template_file)
      end

      # Will throw Consul::Async::InvalidTemplateException if template invalid
      def update_template(new_template)
        return false unless new_template != @template
        # We render to ensure the template is valid
        render(new_template)
        @template = new_template.freeze
        true
      end

      def write
        success, modified, last_res = @template_manager.write(@output_file, @template, @last_result, template_file)
        @last_result = last_res if last_res
        [success, modified, @last_result]
      end

      def hot_reload_if_needed
        new_time = File.ctime(template_file)
        if template_file_ctime != new_time
          begin
            @template_file_ctime = new_time
            return update_template(load_template)
          rescue Consul::Async::InvalidTemplateException => e
            STDERR.puts "****\n[ERROR] HOT Reload of template #{template_file} did fail due to #{e}\n****\n"
            raise e unless hot_reload_failure == 'keep'
            STDERR.puts "[WARN] Hot reload of #{template_file} was not taken into account, keep running with previous version"
          end
        end
        false
      end
    end
  end
end
