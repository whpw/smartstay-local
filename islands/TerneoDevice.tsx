import { HOUR, MINUTE, SECOND } from '$std/datetime/constants.ts'
import { DeviceConfig, JacuzziConfig } from '@/model/device.ts'
import { JWTData } from '@/model/jwt.ts'
import { useSWR } from '@/utils/useSWR.ts'
import { useRef, useState } from 'preact/hooks'

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export const TerneoDevice = (
    { device, jwt }: { device: DeviceConfig; jwt: JWTData },
) => {
    // Getting data from device API
    const { data, error, mutate } = useSWR<JacuzziConfig>(
        '/api/device/' + device.id,
        fetcher,
        { interval: 10 * SECOND },
    )

    // Time when new session will end
    const [newSessionEnd, setNewSessionEnd] = useState<string | null>(null)

    // Upselling state
    const [upsellingState, setUpsellingState] = useState<'info' | 'refresh'>(
        'info',
    )

    // Modals refs
    const confirmModalRef = useRef<HTMLDialogElement>(null)
    const upsellModalRef = useRef<HTMLDialogElement>(null)

    // TODO support error state
    if (error) return <div>{'An error has occurred: ' + error}</div>
    // TODO support loading state
    if (!data) return <div>Loading...</div>

    // Checking if session is running
    const isRunning = data.sessionEnd !== null
    // Calculating duration that is left
    const duration = (data.sessionEnd || 0) - Date.now()
    // Calculating hours and minutes left
    const hours = Math.floor(duration / HOUR)
    const minutes = Math.floor(duration % HOUR / MINUTE)

    // Checking if user has no limit option
    const noLimit = jwt.res.addons.some((addon) =>
        addon.toLowerCase().includes('jacuzzi')
    )

    const startSession = async () => {
        // Call API
        const res = await fetch('/api/device/' + device.id + '/action', {
            method: 'POST',
            body: JSON.stringify({
                type: 'START',
            }),
        }).then((res) => res.json())

        if (res.error === 'REACHED_LIMIT') {
            upsellModalRef.current?.showModal()
            return
        }

        // Refresh data
        mutate()
    }

    const onStartClick = () => {
        if (!noLimit) {
            const end = new Date(Date.now() + data.sessionDuration * MINUTE)
            setNewSessionEnd(
                end.getHours() + ':' +
                    end.getMinutes().toString().padStart(2, '0'),
            )
            confirmModalRef.current?.showModal()
            return
        }

        // Start session
        startSession()
    }

    const onConfirmedStartClick = () => {
        confirmModalRef.current?.close()
        startSession()
    }

    const onTemperatureChange = (value: number) => {
        fetch('/api/device/' + device.id + '/action', {
            method: 'POST',
            body: JSON.stringify({
                type: 'SET_TARGET_TEMP',
                value: value,
            }),
        }).then(() => {
            mutate()
        })
    }

    const onUpsellClick = () => {
        setUpsellingState('refresh')
    }

    return (
        <>
            <div className='grid grid-cols-2 rounded-md bg-gray-700 p-5'>
                <div>
                    <h1 className='text-xl text-gray-200'>Jacuzzi</h1>

                    <button
                        onClick={onStartClick}
                        className='btn btn-sm btn-primary mt-5'
                        disabled={isRunning}
                    >
                        {isRunning
                            ? `Koniec za: ${hours}:${minutes}`
                            : 'Uruchom'}
                    </button>
                </div>
                <div className='text-gray-200 text-right'>
                    <div className='text-4xl'>
                        → {data.targetTemp} °C
                    </div>
                    <div className='text-md mt-2'>
                        Obecna {data.currentTemp} °C
                    </div>
                </div>
                {isRunning && (
                    <div className='col-span-2 mt-5'>
                        <div className='flex flex-row justify-between text-xs mb-2'>
                            <span>{data.minTemperature} °C</span>
                            <span>{data.maxTemperature} °C</span>
                        </div>
                        <input
                            type='range'
                            min={data.minTemperature}
                            max={data.maxTemperature}
                            value={data.targetTemp}
                            onChange={(e) => {
                                const target = e.target as HTMLInputElement
                                if (target) {
                                    onTemperatureChange(parseInt(target.value))
                                }
                            }}
                            className='range'
                            step='1'
                            title='Temperatura'
                        />
                    </div>
                )}
            </div>
            <dialog ref={confirmModalRef} className='modal'>
                <div className='modal-box w-11/12 max-w-5xl'>
                    <h3 className='font-bold text-lg'>
                        Czy uruchomić jacuzzi?
                    </h3>
                    <p className='py-4'>
                        Do godziny: {newSessionEnd}
                    </p>
                    <details className='collapse collapse-arrow bg-base-200'>
                        <summary className='collapse-title'>
                            Przeczytaj więcej informacji
                        </summary>
                        <div className='collapse-content'>
                            <p>
                                Po uruchomieniu sesji nie będzie możliwości jej
                                zatrzymania. Jeżeli jeszcze dzisiaj będziesz
                                chciał skorzystać z jacuzzi, konieczne będzie
                                wykupienie nielimitowanego dostępu.
                            </p>
                        </div>
                    </details>

                    <div className='modal-action'>
                        <form method='dialog'>
                            <button className='btn'>Anuluj</button>
                        </form>
                        <button
                            className='btn btn-primary'
                            onClick={onConfirmedStartClick}
                        >
                            Uruchom
                        </button>
                    </div>
                </div>
            </dialog>
            <dialog ref={upsellModalRef} className='modal'>
                <div className='modal-box w-11/12 max-w-5xl'>
                    {upsellingState === 'info' && (
                        <>
                            <h3 className='font-bold text-lg'>
                                Wykorzystałeś limit na dzisiaj :(
                            </h3>
                            <p className='py-4'>
                                Czy chcesz wykupić nielimitowany dostęp?
                            </p>
                            <div className='modal-action'>
                                <form method='dialog'>
                                    <button className='btn'>Anuluj</button>
                                </form>
                                <a
                                    href={jwt.res.addonsUrl}
                                    className='btn btn-primary'
                                    target='_blank'
                                    onClick={onUpsellClick}
                                >
                                    Wykup dostęp
                                </a>
                            </div>
                        </>
                    )}
                    {upsellingState === 'refresh' && (
                        <>
                            <h3 className='font-bold text-lg'>
                                Dziękujemy za zakup!
                            </h3>
                            <p className='py-4'>
                                Musisz się zalogować ponownie, aby odświeżyć
                                uprawnienia.
                            </p>
                            <div className='modal-action'>
                                <form method='dialog'>
                                    <button className='btn'>Anuluj</button>
                                </form>
                                <a
                                    href='/api/logout'
                                    className='btn btn-primary'
                                >
                                    Zaloguj się
                                </a>
                            </div>
                        </>
                    )}
                </div>
            </dialog>
        </>
    )
}
