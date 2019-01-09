require 'tempfile'
require 'yaml'
require 'json'
module Consul
  module Async
    class Utilities
      def self.bytes_to_h(bytes)
        if bytes < 1024
          "#{bytes} b"
        else
          if bytes < 1_048_576
            bytes_h = bytes / 1024.0
            unit_prefix = 'K'
          elsif bytes < 1_073_741_824
            bytes_h = bytes / 1_048_576.0
            unit_prefix = 'M'
          else
            bytes_h = bytes / 1_073_741_824.0
            unit_prefix = 'G'
          end
          "#{bytes_h.round(2)} #{unit_prefix}b"
        end
      end

      # Loads parameters from a file, supports JSON and YAML
      def self.load_parameters_from_file(parameters_file)
        raise "Parameters file #{parameters_file} does not exists" unless File.exist? parameters_file
        if parameters_file.downcase.end_with?('.yaml', '.yml')
          YAML.load_file(parameters_file)
        elsif parameters_file.downcase.end_with?('.json')
          JSON.parse(File.read(parameters_file))
        else
          raise "Don't know how to load parameters file #{parameters_file}: JSON and YAML supported"
        end
      end

      def self.random
        @random = Random.new unless @random
        @random
      end
    end
  end
end
