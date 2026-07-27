package types

type Set[T comparable] struct {
	items map[T]struct{}
}

// NewSet 创建并返回一个新的 Set
func NewSet[T comparable]() *Set[T] {
	return &Set[T]{
		items: make(map[T]struct{}),
	}
}

func (s *Set[T]) Add(item T) {
	s.items[item] = struct{}{}
}

// Remove 从 Set 中移除一个元素
func (s *Set[T]) Remove(item T) {
	delete(s.items, item)
}

// Contains 检查 Set 是否包含某个元素
func (s *Set[T]) Contains(item T) bool {
	_, exists := s.items[item]
	return exists
}

// Len 返回 Set 中元素的数量
func (s *Set[T]) Len() int {
	return len(s.items)
}

// Items 返回 Set 中所有元素组成的切片
// 注意：由于 map 的无序性，返回的切片元素顺序是随机的
func (s *Set[T]) Items() []T {
	items := make([]T, 0, s.Len())
	for item := range s.items {
		items = append(items, item)
	}
	return items
}
