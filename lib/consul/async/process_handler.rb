module Consul
  module Async
    class ProcessHandler
      attr_reader :command, :sig_reload, :sig_term, :pid
      def initialize(command, sig_reload: 'HUP', sig_term: 'TERM')
        @command = command
        @sig_reload = sig_reload
        @sig_term = sig_term
        @pid = nil
      end

      def start
        return pid unless pid.nil?
        @pid = Process.spawn(command)
      end

      def reload
        STDERR.puts "Sending #{sig_reload} to #{pid}..."
        begin
          Process.kill(sig_reload, pid)
        rescue Errno::ESRCH => e
          STDERR.puts "*** Process #{pid} has already been killed: #{e.inspect}"
          raise e
        end
      end

      def kill
        STDERR.puts "Sending #{sig_term} to #{pid}..."
        begin
          Process.kill(sig_term, pid)
        rescue Errno::ESRCH
          STDERR.puts "*** Process #{pid} has already been killed"
        end
        begin
          _pid, exit_status = Process.waitpid2 pid
        rescue SystemCallError
          STDERR.puts "*** UNEXPECTED ERROR *** Failed to get return code for #{pid}"
        end
        exit_status
      end

      def process_status
        cpid, result = Process.waitpid2(pid, Process::WNOHANG)
        raise "Unexpected PID: #{cpid}, was expecting #{pid}" unless cpid == pid
        result
      end
    end
  end
end
