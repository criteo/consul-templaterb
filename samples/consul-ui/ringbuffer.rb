module ConsulTimeline
  class RingBufferNode
    attr_reader :prev, :value, :next
    attr_writer :prev, :next, :value
    def initialize(value, p_elem, n_elem)
      @value = value
      @prev = p_elem
      @next = n_elem
    end

    # Insert element before current element, return inserted Node
    def insert_before(obj)
      old_prev = @prev
      @prev = RingBufferNode.new(obj, old_prev, self)
      old_prev&.next = @prev
      @prev
    end

    # Append element after current ince, return inserted Node
    def append(obj)
      old_next = @next
      @next = RingBufferNode.new(obj, self, old_next)
      old_next&.prev = @next
      @next
    end

    def to_s
      "[prev=#{@prev.object_id}, next=#{@next.object_id}, value=#{@value}]"
    end
  end
  class SortedRingBuffer
    include Enumerable
    def initialize(max_size, sort_func)
      raise "Invalid size #{max_size}" unless max_size.positive?
      @head = RingBufferNode.new(nil, nil, nil)
      @sort_func = sort_func
      @tail = @head
      @max_size = max_size
      (max_size - 1).times do
        @head = @head.insert_before(nil)
      end
    end

    def push(obj)
      return unless obj
      cur = @tail
      raise "No head.next found in #{@head}" unless @head.next
      while cur && cur.value && @sort_func.call(cur.value, obj).positive?
        cur = cur.prev
      end
      if cur.nil?
        # The value we try to insert is before @head
        # no need to do anything
      elsif cur == @head
        # This is the head, just update the value
        @head.value = obj
      else
        @head = @head.next
        @head.prev = nil
        new_val = cur.append(obj)
        @tail = new_val if @tail == cur
      end
    end

    def each
      return enum_for(:each) unless block_given? # Sparkling magic!
      cur = @head
      until cur.nil?
        yield cur.value if cur.value
        cur = cur.next
      end
    end

    def to_a
      arr = Array.new(@max_size)
      cur = @head
      i = 0
      until cur.nil?
        if cur.value
          arr[i] = cur.value
          i += 1
        end
        cur = cur.next
      end
      if i != @max_size
        arr.reject(&:nil?)
      else
        arr
      end
    end
  end
end

if ARGV.count.positive? && ARGV[0] == 'debug'
  require 'json'
  size = 10
  ringbuff = ConsulTimeline::SortedRingBuffer.new(size, ->(a, b) { a <=> b })
  ringbuff.push 0.5
  puts ringbuff.to_a
  (size * 10).times do |i|
    ringbuff.push(2 * i + Random.rand(size / 10))
  end
  ringbuff.push 99_999_999_999_999
  arr = ringbuff.to_a
  raise "OOPS wrong size := #{arr.count} instead of #{size}" unless arr.count == size
  STDOUT.puts JSON.generate(arr)
end
