export function CustomMessage({ message }: { message: string }) {
  return (
    <div class="py-2">
      <div class="italic">This is a custom message:</div>
      <p>{message}</p>
    </div>
  )
}
