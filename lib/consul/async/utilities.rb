module Consul
  module Async
    class Utilities
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
    end
  end
end
