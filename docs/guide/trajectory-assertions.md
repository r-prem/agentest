# Trajectory Assertions

Verify tool call sequences deterministically.

## Match Modes

```ts
assertions: {
  toolCalls: {
    matchMode: 'strict',  // 'strict' | 'unordered' | 'contains' | 'within'
    expected: [
      { name: 'search_products', argMatchMode: 'ignore' },
      { name: 'add_to_cart', argMatchMode: 'partial' },
    ],
  },
},
```

## Argument Matching

```ts
expected: [
  // Don't check arguments
  { name: 'list_items', argMatchMode: 'ignore' },

  // Partial match
  { name: 'add_to_cart', args: { productId: 'SKU-123' }, argMatchMode: 'partial' },

  // Exact match
  { name: 'checkout', args: { currency: 'USD' }, argMatchMode: 'exact' },
]
```

## Match Mode Details

| Mode | Description |
|------|-------------|
| `strict` | Exact tools in exact order, exact count |
| `unordered` | All expected tools must appear, any order |
| `contains` | All expected tools must appear, extras allowed |
| `within` | Every actual call must be in expected set |
