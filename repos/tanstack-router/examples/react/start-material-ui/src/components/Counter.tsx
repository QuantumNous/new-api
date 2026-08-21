import { Stack } from '@mui/material'
import { useSearch } from '@tanstack/react-router'
import { CustomButtonLink } from '~/components/CustomButtonLink'

export function Counter() {
  const { count = 0 } = useSearch({ from: '/' })

  return (
    <Stack>
      <CustomButtonLink
        variant="contained"
        size="large"
        to={'/'}
        search={{ count: count + 1 }}
      >
        Clicks: {count}
      </CustomButtonLink>
    </Stack>
  )
}
