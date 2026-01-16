/**
 * File: LRUCache.ts
 * Author: Wildflover
 * Description: Generic LRU (Least Recently Used) cache implementation
 *              - O(1) get/set/delete operations using doubly linked list
 *              - Automatic eviction of least recently used items
 *              - Memory tracking for resource management
 * Language: TypeScript
 */

// [INTERFACE] LRU cache node for doubly linked list
export interface CacheNode<T> {
  key: string;
  value: T;
  size: number;
  prev: CacheNode<T> | null;
  next: CacheNode<T> | null;
}

// [CLASS] Generic LRU Cache with O(1) operations
export class LRUCache<T> {
  private cache: Map<string, CacheNode<T>> = new Map();
  private head: CacheNode<T> | null = null;
  private tail: CacheNode<T> | null = null;
  private maxSize: number;
  private currentSize: number = 0;
  private estimatedMemoryMB: number = 0;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  // [METHOD] Move node to front (most recently used)
  private moveToFront(node: CacheNode<T>): void {
    if (node === this.head) return;

    // Remove from current position
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (node === this.tail) this.tail = node.prev;

    // Move to front
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  // [METHOD] Add node to front
  private addToFront(node: CacheNode<T>): void {
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  // [METHOD] Remove tail node (least recently used)
  private removeTail(): CacheNode<T> | null {
    if (!this.tail) return null;

    const removed = this.tail;
    this.cache.delete(removed.key);
    
    if (this.tail.prev) {
      this.tail.prev.next = null;
      this.tail = this.tail.prev;
    } else {
      this.head = null;
      this.tail = null;
    }

    this.currentSize--;
    this.estimatedMemoryMB -= removed.size;
    return removed;
  }

  // [METHOD] Get value from cache (marks as recently used)
  get(key: string): T | null {
    const node = this.cache.get(key);
    if (!node) return null;

    this.moveToFront(node);
    return node.value;
  }

  // [METHOD] Check if key exists without updating LRU order
  has(key: string): boolean {
    return this.cache.has(key);
  }

  // [METHOD] Add value to cache with eviction if needed
  set(key: string, value: T, sizeMB: number = 0.5): void {
    // If already exists, update and move to front
    if (this.cache.has(key)) {
      const node = this.cache.get(key)!;
      node.value = value;
      this.moveToFront(node);
      return;
    }

    // Evict if at capacity
    while (this.currentSize >= this.maxSize) {
      this.removeTail();
    }

    // Add new node
    const node: CacheNode<T> = {
      key,
      value,
      size: sizeMB,
      prev: null,
      next: null
    };

    this.cache.set(key, node);
    this.addToFront(node);
    this.currentSize++;
    this.estimatedMemoryMB += sizeMB;
  }

  // [METHOD] Remove specific key
  delete(key: string): boolean {
    const node = this.cache.get(key);
    if (!node) return false;

    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
    if (node === this.head) this.head = node.next;
    if (node === this.tail) this.tail = node.prev;

    this.cache.delete(key);
    this.currentSize--;
    this.estimatedMemoryMB -= node.size;
    return true;
  }

  // [METHOD] Clear entire cache
  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.currentSize = 0;
    this.estimatedMemoryMB = 0;
  }

  // [METHOD] Evict oldest entries to reduce memory
  evict(count: number): number {
    let evicted = 0;
    while (evicted < count && this.tail) {
      this.removeTail();
      evicted++;
    }
    return evicted;
  }

  // [GETTER] Current cache size
  get size(): number {
    return this.currentSize;
  }

  // [GETTER] Estimated memory usage in MB
  get memoryMB(): number {
    return this.estimatedMemoryMB;
  }
}
