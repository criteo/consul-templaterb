module Consul
  module Async
    class ProcessDoesNotExist < StandardError
    end
    class ProcessHandler
      attr_reader :command, :sig_reload, :sig_term, :pid, :exit_status
      def initialize(command, sig_reload: 'HUP', sig_term: 'TERM')
        raise 'empty sig_term is not supported' unless sig_term
        @command = command
        @sig_reload = sig_reload
        @sig_term = sig_term
        @pid = nil
        @exit_status = nil
      end

      def start
        return pid unless pid.nil?
        @pid = Process.spawn(command)
      end

      def reload
        return if sig_reload.nil?
        STDERR.puts "Sending SIG #{sig_reload} to #{pid}..."
        begin
          Process.kill(sig_reload, pid)
        rescue Errno::ESRCH => e
          STDERR.puts "*** Process #{pid} has already been killed: #{e.inspect}"
          raise e
        end
      end

      def kill
        return exit_status if pid.nil?
        the_pid = pid
        @pid = nil
        STDERR.puts "[KILL] Sending SIG #{sig_term} to #{the_pid}..."
        begin
          STDERR.puts "[KILL] waiting for #{the_pid}..."
          Process.kill(sig_term, the_pid)
        rescue Errno::ESRCH
          STDERR.puts "[KILL] *** Process #{the_pid} has already been killed"
        end
        begin
          _pid, @exit_status = Process.waitpid2 the_pid
        rescue SystemCallError
          STDERR.puts "[KILL] *** UNEXPECTED ERROR *** Failed to get return code for #{the_pid}"
        end
        exit_status
      end

      def process_status
        raise ProcessDoesNotExist, 'No child process' if pid.nil?
        begin
          cpid, result = Process.waitpid2(pid, Process::WNOHANG)
          raise ProcessDoesNotExist, "Unexpected PID: #{cpid}, was expecting #{pid}" unless cpid.nil? || cpid == pid
          result
        rescue Errno::ECHILD => e
          e2 = ProcessDoesNotExist.new e
          raise e2, "ChildProcess has been killed: #{e.message}", e.backtrace
        end
      end
    end
  end
end
