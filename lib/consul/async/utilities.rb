require 'tempfile'
require 'yaml'
require 'json'

module Consul
  module Async
    class Utilities
      def self.valid_json?(json)
        !!JSON.parse(json)
      rescue JSON::ParserError => _e
        false
      end

      def self.bytes_to_h(bytes)
        if bytes < 1024
          "#{bytes} b"
        elsif bytes < 1_048_576
          "#{(bytes / 1024).round(2)} Kb"
        elsif bytes < 1_073_741_824
          "#{(bytes / 1_048_576.0).round(2)} Mb"
        else
          "#{(bytes / 1_073_741_824.0).round(2)} Gb"
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
    end
  end
end
