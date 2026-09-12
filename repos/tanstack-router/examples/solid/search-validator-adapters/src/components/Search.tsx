export interface SearchProps {
  search: string
  onChange: (search: string) => void
}

export const Search = ({ search, onChange }: SearchProps) => {
  return (
    <div class="flex gap-2 align-center items-center">
      <label>Search</label>
      <input
        type="search"
        class="border p-1 px-2 rounded-sm"
        value={search}
        onInput={(e) => onChange(e.currentTarget.value)}
      ></input>
    </div>
  )
}
