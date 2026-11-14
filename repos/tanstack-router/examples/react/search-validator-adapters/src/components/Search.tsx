export interface SearchProps {
  search: string
  onChange: (search: string) => void
}

export const Search = ({ search, onChange }: SearchProps) => {
  return (
    <div className="flex gap-2 align-center items-center">
      <label>Search</label>
      <input
        type="search"
        className="border p-1 px-2 rounded-sm"
        value={search}
        onChange={(e) => onChange(e.target.value)}
      ></input>
    </div>
  )
}
