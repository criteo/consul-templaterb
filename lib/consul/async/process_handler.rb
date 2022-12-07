module Consul
  module Async
    # Exception thrown when process does not exists
    class ProcessDoesNotExist < StandardError
    end

    # Handle the full lifecycle of a process and allows to forward
    # Posix signals to child process when needed.
    class ProcessHandler
      attr_reader :command, :sig_reload, :sig_term, :pid, :exit_status, :last_signal_sent, :reload_scheduled
      attr_writer :reload_scheduled

      def restart
        warn "Restart process with pid #{pid}"
        kill
        start
        @reload_scheduled = false
      end

      def initialize(command, sig_reload: 'HUP', sig_term: 'TERM')
        raise 'empty sig_term is not supported' unless sig_term

        @command = command
        @sig_reload = sig_reload
        @sig_term = sig_term
        @pid = nil
        @exit_status = nil
        @last_signal_sent = Time.now
        @reload_scheduled = false
      end

      def start
        return pid unless pid.nil?

        @pid = Process.spawn(command)
        @last_signal_sent = Time.now
      end

      def reload
        return if sig_reload.nil?

        @last_signal_sent = Time.now
        warn "Sending SIG #{sig_reload} to #{pid}..."
        @reload_scheduled = false
        begin
          Process.kill(sig_reload, pid)
        rescue Errno::ESRCH => e
          warn "*** Process #{pid} has already been killed: #{e.inspect}"
          raise e
        end
      end

      def kill
        return exit_status if pid.nil?

        the_pid = pid
        @pid = nil
        warn "[KILL] Sending SIG #{sig_term} to #{the_pid}..."
        begin
          warn "[KILL] waiting for #{the_pid}..."
          Process.kill(sig_term, the_pid)
        rescue Errno::ESRCH
          warn "[KILL] *** Process #{the_pid} has already been killed"
        end
        begin
          _pid, @exit_status = Process.waitpid2 the_pid
        rescue SystemCallError
          warn "[KILL] *** UNEXPECTED ERROR *** Failed to get return code for #{the_pid}"
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
