require 'consul/async/utilities'

module Consul
  module Async
    class EndPointStats
      attr_reader :successes, :errors, :start, :body_bytes, :last_error, :last_success, :changes, :network_bytes

      def initialize
        @start = Time.now.utc
        @successes = 0
        @errors = 0
        @body_bytes = 0
        @changes = 0
        @network_bytes = 0
        @last_error = @start
        @last_success = @start
      end

      def on_response(res)
        @last_success = Time.now.utc
        @successes += 1
        @body_bytes += res.http.response.bytesize
        @changes += 1 if res.modified?
        @network_bytes += res.http.response_header['Content-Length'].to_i
      end

      def on_error(_http)
        @last_error = Time.now.utc
        @errors += 1
      end

      def bytes_per_sec(now = Time.now.utc)
        diff = (now - start)
        diff = 1 if diff < 1
        (body_bytes / diff).round(0)
      end

      def bytes_per_sec_human(now = Time.now.utc)
        "#{Utilities.bytes_to_h(bytes_per_sec(now))}/s"
      end

      def body_bytes_human
        Utilities.bytes_to_h(body_bytes)
      end

      def last_success_or_error
        [@last_error, @last_success].max
      end
    end
  end
end
