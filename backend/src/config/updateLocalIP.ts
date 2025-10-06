import { ip } from 'address'
import ky from 'ky'

export async function updateLocalIP(port: number) {
  try {
    //
    console.log('Updating local IP...')

    // Getting local address
    const networkAddr = ip()

    // Getting port string
    const portStr = port !== 80 ? `:${port}` : ''

    // Getting current IP
    const currentIP = `${networkAddr}${portStr}`

    // Sending request to update local address
    await ky.patch(`${process.env.CONFIG_API_URL}/ip`, {
      json: { ip: currentIP },
      headers: {
        Authorization: `Bearer ${process.env.CONFIG_API_KEY}`,
      },
    })

    console.log('Local IP updated successfully:', currentIP)
  } catch (err) {
    console.error('Error updating local IP:', err)
  }
}
