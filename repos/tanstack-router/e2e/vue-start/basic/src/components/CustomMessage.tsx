import { defineComponent } from 'vue'

export const CustomMessage = defineComponent({
  props: {
    message: {
      type: String,
      required: true,
    },
  },
  setup(props) {
    return () => (
      <div class="py-2">
        <div class="italic">This is a custom message:</div>
        <p>{props.message}</p>
      </div>
    )
  },
})
