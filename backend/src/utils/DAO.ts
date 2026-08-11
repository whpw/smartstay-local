import type { FailedHotresRequestDTO } from '@/models/HotresDTOs'
import ky from 'ky'

import { appConfig } from '@/config'

const api = ky.extend({
  prefix: 'https://panel.hotres.pl',
  hooks: {
    beforeRequest: [
      function ({ request }) {
        // Creating new URL with credentials
        const urlWithCredentials = new URL(request.url)
        urlWithCredentials.searchParams.set('auth', appConfig.hotresAuthCode)
        urlWithCredentials.searchParams.set('apikey', appConfig.hotresApiKey)

        // Returning new request with credentials
        return new Request(urlWithCredentials.toString(), request)
      },
    ],
  },
})

class HotresError extends Error {
  public request?: object
  constructor(message: string, request?: object) {
    super(message)
    this.name = 'HotresError'
    this.request = request
  }
}

function throwIfError<T>(data: T | FailedHotresRequestDTO, request?: object) {
  const error = data as FailedHotresRequestDTO
  if (error.result === 'error') {
    throw new HotresError(error.message, request)
  }
}

export const DAO = {
  get: function <T>(
    url: string,
    params: Record<string, string | number | boolean> = {}
  ) {
    return api
      .get<T | FailedHotresRequestDTO>(url, {
        searchParams: {
          ...params,
        },
      })
      .json()
      .then((res) => {
        throwIfError(res, { url, params })
        return res as T
      })
  },
  post: function <T>(url: string, data: object | undefined) {
    const form = new FormData()

    const formObject = {
      ...data,
    }

    Object.entries(formObject).forEach(([key, value]) => {
      form.append(key, value as string)
    })

    return api
      .post<T | FailedHotresRequestDTO>(url, {
        body: form,
      })
      .json()
      .then((res) => {
        throwIfError(res, { url, data })
        return res as T
      })
  },
}
