import { ref, computed, watchEffect, Ref } from 'vue'
import { type PaginationState } from '@tanstack/vue-table'

const DEFAULT_PAGE_COUNT = -1
const DEFAULT_RESULT_COUNT = -1

const endpoint = 'https://jsonplaceholder.typicode.com/posts'

export default function useService(pagination: Ref<PaginationState>) {
  const data = ref(null)
  const totalResultCount = ref(DEFAULT_RESULT_COUNT)
  const error = ref(null)
  const isLoading = ref(false)
  const request = ref<Promise<any> | null>(null)

  const requestParams = computed(() => {
    const { pageSize, pageIndex } = pagination.value
    const currentPage = pageIndex + 1

    return {
      _limit: pageSize.toString(),
      _page: currentPage.toString(),
    }
  })

  const url = computed(() => {
    const searchParams = new URLSearchParams(requestParams.value)
    return `${endpoint}?${searchParams}`
  })

  const pageCount = computed(() => {
    const { pageSize } = pagination.value

    return Math.ceil(totalResultCount.value / pageSize)
  })

  watchEffect(() => {
    isLoading.value = true

    request.value = fetch(url.value)
      .then(async response => {
        const responseData = await response.json()

        if (response.ok) {
          data.value = responseData
          error.value = null
          totalResultCount.value =
            Number(response.headers.get('x-total-count')) ?? DEFAULT_PAGE_COUNT
        } else {
          throw new Error('Network response was not OK')
        }
      })
      .catch(error => {
        error.value = error
        data.value = null
        totalResultCount.value = DEFAULT_PAGE_COUNT

        console.log('error!', error)
      })
      .finally(() => {
        isLoading.value = false
      })
  })

  return {
    data,
    totalResultCount,
    pageCount,
    error,
    isLoading,
  }
}
