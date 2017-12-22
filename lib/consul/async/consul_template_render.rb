require 'consul/async/utilities'
require 'em-http'
require 'thread'
require 'erb'
module Consul
  module Async
    class ConsulTemplateRender
      attr_reader :template_file, :output_file, :template_file_ctime, :hot_reload_failure
      def initialize(template_manager, template_file, output_file, hot_reload_failure: 'die')
        @hot_reload_failure = hot_reload_failure
        @template_file = template_file
        @output_file = output_file
        @template_manager = template_manager
        @last_result = ''
        @template = load_template
      end

      def render(tpl = @template)
        @template_manager.render(tpl)
      end

      def run
        hot_reload_if_needed || write
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
        sucess, @last_result = @template_manager.write(@output_file, @template, @last_result)
        sucess
      end

      def hot_reload_if_needed
        new_time = File.ctime(template_file)
        begin
          @template_file_ctime = new_time
          ret = update_template(load_template)
          if ret
            STDERR.puts "[INFO] Hot reload of template #{template_file} with success"
            write
          end
          return ret
        rescue Consul::Async::InvalidTemplateException => e
          STDERR.puts "****\n[ERROR] HOT Reload of template #{template_file} did fail due to #{e}\n****\n"
          raise e unless hot_reload_failure == 'keep'
          STDERR.puts "[WARN] Hot reload of #{template_file} was not taken into account, keep running with previous version"
          false
        end if template_file_ctime != new_time
      end
      false
    end
  end
end
