import { Show } from 'solid-js'

export function ErrorMessage(props: { message: string | null }) {
  return (
    <Show when={props.message}>
      <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong class="font-bold">Error: </strong>
        <span class="block sm:inline">{props.message}</span>
      </div>
    </Show>
  )
}
