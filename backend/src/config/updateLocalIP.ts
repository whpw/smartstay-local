import { ip } from 'address'
import ky from 'ky'

export async function updateLocalIP() {
  try {
    //
    console.log('Updating local IP...')

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

    console.log('Local IP updated successfully:', networkAddr)
  } catch (err) {
    console.error('Error updating local IP:', err)
  }
}
