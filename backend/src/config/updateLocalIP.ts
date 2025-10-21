import { ip } from 'address'
import ky from 'ky'

export async function updateLocalIP() {
  try {
    //
    console.log('Updating local IP...')

    // Getting local address
    const networkAddr = ip()

    const CONFIG_ROOM_ID = process.env.CONFIG_ROOM_ID as string
    const CONFIG_OBJECT_ID = process.env.CONFIG_OBJECT_ID as string

    // Sending request to update local address
    await ky.post(`${process.env.CONFIG_UPDATE_IP_URL}`, {
      json: {
        ip: networkAddr,
        roomId: CONFIG_ROOM_ID,
        objectId: CONFIG_OBJECT_ID,
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
