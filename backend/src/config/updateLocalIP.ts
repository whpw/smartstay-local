import { logger } from '@/utils/logger'
import { ip } from 'address'
import ky from 'ky'

export async function updateLocalIP() {
  logger.debug('Updating local IP...')
  try {
    // Getting local address
    const networkAddr = ip()

    // Sending request to update local address
    await ky.post(`${process.env.CONFIG_UPDATE_IP_URL}`, {
      json: {
        ip: networkAddr,
      },
      headers: {
        Authorization: `Bearer ${process.env.CONFIG_API_KEY}`,
      },
    })

    logger.info('Local IP updated successfully')
  } catch (err) {
    logger.error('Error updating local IP:', err)
  }
}
