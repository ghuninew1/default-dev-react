import { useState, useEffect } from 'react'
import { useWindowScroll } from './useWindowScroll'
import { useIdle } from './useHooks'

function App() {
  
  const [count, setCount] = useState(0)
  const [y, scrollTo] = useWindowScroll()

  const idle = useIdle(10000)

  
  useEffect(() => {
    if (idle && y.y !== 0) {
      scrollTo({ top: 0, behavior: 'instant' })
      console.log('idle');
    }
  }, [idle, scrollTo, y.y])


  return (
    <div className='h-[1000vh]'>
    <div className='fixed right-2 top-2 transform-gpu'>
    {y.y}
      <div className='flex min-h-screen w-full items-center justify-center'>
        <button className={`rounded-md bg-slate-200 p-3 text-3xl`} onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <button className='rounded-md bg-slate-200 p-3 text-3xl' onClick={() => scrollTo({ top: 0, behavior: 'smooth' })}>
          top
        </button>
    </div>
      </div>
    </div>
  )
}

export default App
