import Head from 'next/head'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useSpring, animated } from 'react-spring'
import styles from '../styles/Home.module.css'

function useAPI() {
  const [data, setData] = useState("")
  const baseURL = 'http://localhost:8081'

  // if TypeError, abort all requests after?
  async function loadDiff(cmd: string) {
    if (!['prev', 'curr', 'next'].includes(cmd)){
      return
    }
    // if caching, return if already requested
    const data = await (
      fetch(`${baseURL}/commit/${cmd}`)
        .then(data => data)
        .catch(err => ({ text: () => err.message }))
    )
    const text = await data.text();
    // if (data.ok) { 
    //  would be nice to cache texts + avoid requests
    //  but would need some semblance of hash order
    //  and need to change api to:
    //  - send block of hashes
    //  - then client needs to specify hash to get diff
    // }
    setData(text.slice(0, -1))
  }
  return { data, loadDiff };
}

function Frame() {
  const { data, loadDiff } = useAPI()
  const styles = useSpring({
    from: { opacity: 0.3 },
    to: { opacity: 1 },
    config: { 
      mass: 1, 
      tension: 280, 
      friction: 120,
      frequency: 2,
    },
    reset: true,
  })

  useEffect(() => {
    // load some commits here
    loadDiff('curr')
    async function handleKey({ code }) {
      console.log(code)
      if (code === 'ArrowLeft') { 
        await loadDiff('prev')
      }
      if (code === 'ArrowRight') {
        // todo: bound by number of commits
        await loadDiff('next')
      }
    }
    window?.addEventListener('keydown', handleKey)
    // passive?
    return() => window?.removeEventListener('keydown', handleKey)
  }, [])

  const lines = data.split('\n')
  const cols = Math.max(...lines.map(line => line.length))

  // rows and cols padded to avoid scrolling + overflow
  return (
      <animated.textarea 
        style={styles} 
        rows={lines.length + 1} 
        cols={cols + 5} 
        value={data} 
        readOnly 
      />
  )
}

export default function Home() {
  return (
    <div className={styles.container}>
      <Head>
        <title>Create Next App</title>
        <meta name="description" content="Generated by create next app" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <Frame />
      </main>
    </div>
  )
}
