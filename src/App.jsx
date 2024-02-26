import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div className='flex min-h-screen w-full items-center justify-center'>
        <button className='rounded-md bg-slate-200 p-3 text-3xl' onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
      </div>
    </>
  )
}

export default App
