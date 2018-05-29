require 'consul/async/utilities'

module Consul
  module Async
    class EndPointStats
      attr_reader :successes, :errors, :start, :body_bytes

      def initialize
        @start = Time.now.utc
        @successes = 0
        @errors = 0
        @body_bytes = 0
      end

      def on_response(res)
        @successes += 1
        @body_bytes = body_bytes + res.http.response.bytesize
      end

      def on_error(_http)
        @errors += 1
      end

      def bytes_per_sec
        diff = (Time.now.utc - start)
        diff = 1 if diff < 1
        (body_bytes / diff).round(0)
      end

      def bytes_per_sec_human
        "#{Utilities.bytes_to_h(bytes_per_sec)}/s"
      end

      def body_bytes_human
        Utilities.bytes_to_h(body_bytes)
      end
    end
  end
end
