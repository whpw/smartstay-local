import { Handlers, RouteConfig } from '$fresh/server.ts'
import { MINUTE } from '$std/datetime/constants.ts'
import { getDeviceById, setDevice } from '@/devices/config.ts'
import { scheduleStop } from '@/devices/queue.ts'
import { JacuzziConfig } from '@/model/device.ts'
import { JWTData } from '@/model/jwt.ts'
import { terneoFetch } from '@/utils/terneo.ts'
import { endOfToday, formatISO } from 'date-fns'
import { isNull, pick } from 'es-toolkit'

export const config: RouteConfig = {
    routeOverride: '/api/device/:id/action',
}

export enum ActionType {
    START = 'START',
    SET_TARGET_TEMP = 'SET_TARGET_TEMP',
}

interface Action {
    type: string
    value?: unknown
}

const kv = await Deno.openKv()

export const handler: Handlers = {
    async POST(req, ctx) {
        // Get action
        const action = (await req.json()) as Action

        // Get device
        const device = await getDeviceById<JacuzziConfig>(ctx.params.id)

        switch (action.type) {
            case ActionType.START:
                {
                    // Getting current day
                    const day = formatISO(new Date(), {
                        representation: 'date',
                    })

                    // Getting jwt data
                    const jwt = ctx.state.jwt as JWTData

                    // Checking if session can be started
                    if (!await canStartSession(jwt, day)) {
                        return new Response(JSON.stringify({
                            error: 'REACHED_LIMIT',
                        }))
                    }

                    // Starting session
                    await startSession(device)

                    // Increment sessions count
                    const sessionsCount = await getSessionsCount(
                        jwt.res.number,
                        day,
                    )
                    await kv.set(
                        ['sessions', 'jacuzzi', jwt.res.number, day],
                        sessionsCount + 1,
                        {
                            expireIn: endOfToday().getTime() - Date.now(),
                        },
                    )
                }
                break
            case ActionType.SET_TARGET_TEMP:
                await setTargetTemp(device, action.value)
                break
            default:
                return new Response('Unknown action', { status: 400 })
        }

        const updated = await getDeviceById<JacuzziConfig>(ctx.params.id)
        return new Response(
            JSON.stringify(
                pick(updated || {}, [
                    'currentTemp',
                    'targetTemp',
                    'sessionEnd',
                ]),
            ),
        )
    },
}

async function canStartSession(jwt: JWTData, day: string) {
    const resNumber = jwt.res.number
    const resAddons = jwt.res.addons || []
    if (resAddons.includes('jacuzzi')) {
        return true
    }
    const sessionsCount = await getSessionsCount(resNumber, day)
    return sessionsCount === 0 || true
}

async function getSessionsCount(resNumber: string, day: string) {
    const key = [
        'sessions',
        'jacuzzi',
        resNumber,
        day,
    ]
    return await kv.get<number>(key)
        .then((data) => data.value || 0)
}

async function startSession(device: JacuzziConfig) {
    // Start session
    if (isNull(device.sessionEnd)) {
        const delay = 1 * MINUTE

        // Set session end time
        device.sessionEnd = Date.now() + delay
        device.targetTemp = device.defaultTemperature

        console.log(
            'Starting jacuzzi session at:',
            new Date(),
            ', that will end at:',
            new Date(device.sessionEnd),
        )

        // Setting device parameters
        await terneoFetch(device, {
            par: [
                // Making sure it's manual mode
                [2, 2, '1'],
                // Setting target temperature
                [5, 1, String(device.targetTemp)],
                // Setting active hysteresis
                [
                    19,
                    2,
                    String(device.activeHysteresis),
                ],
            ],
        })

        // Update device
        await setDevice(device)

        // Schedule stop
        await scheduleStop(device.id, delay)
    } else {
        throw new Error('Session already started')
    }
}

async function setTargetTemp(device: JacuzziConfig, value: unknown) {
    const targetTemp = parseFloat(value as string)
    if (
        !isNaN(targetTemp) && targetTemp >= device.minTemperature &&
        targetTemp <= device.maxTemperature
    ) {
        // Setting target temperature
        device.targetTemp = targetTemp

        // Setting device parameters
        await terneoFetch(device, {
            par: [[5, 1, String(device.targetTemp)]],
        })

        // Update device
        await setDevice(device)
    } else {
        throw new Error('Invalid target temperature')
    }
}
