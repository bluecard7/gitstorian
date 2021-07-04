import Head from 'next/head'
import Image from 'next/image'
import { Fragment, useCallback, useEffect, useState } from 'react'
import { useSpring, animated } from 'react-spring'
import { of, fromEvent } from 'rxjs'
import { filter, map, throttleTime } from 'rxjs/operators'
import styles from '../styles/Home.module.css'

const baseURL = 'http://localhost:8081'
const observeKeydown = () => fromEvent(document, 'keydown')
  .pipe(
    throttleTime(500),
    map(e => e.code),
    filter(Boolean),
  )
const urlify = (parts: string[]): string => parts.filter(Boolean).join('/')
const fetchData = (pieces: string[]): Promise<Response> => {
  console.log(urlify(pieces))
  return fetch(urlify(pieces))
    .then(data => data)
    .catch(err => ({ text: () => err.message }))
}


async function loadPage(
  order: string = "", 
  hash: string = "", 
  path: string = "",
): Promise<string[]> {
  const res = await fetchData([baseURL, 'commits', order, hash, path])
  return res.ok ? (await res.json()) : []
}

async function loadDiff(
  hash: string = "", 
  path: string = ""
): Promise<{ diff: string[], menu: string[]}> {
  const res = await fetchData([baseURL,'diffs', hash, path])
  return res.json()
}

function useCommits(keydownObserver) {
  const [hashes, setHashes] = useState([])
  const [pos, setPos] = useState(0)
  const [path, setPath] = useState("")
  useEffect(() => {
    // get the first page
    loadPage("next").then(page => setHashes(page))
    const subscription = keydownObserver.subscribe(code => {
      // todo: need to check if page is empty or not
      switch (code) {
        case 'ArrowLeft':
          0 < pos && setPos(old => old - 1)
          pos === 0 && loadPage('prev', hashes[pos], path).then(page => {
            setHashes([...page, ...hashes])
            setPos(page.length - 1)
          })
          break
        case 'ArrowRight':
          const last = hashes.length - 1
          pos < last && setPos(old => old + 1)
          pos === last && loadPage('next', hashes[pos], path).then(page => {
            setHashes([...hashes, ...page])
            setPos(old => old + 1)
          })
      }
    });
    return subscription.unsubscribe
  }, [])
  // hash could be undefined
  return { hash: hashes[pos], setPath }
}

function useDiff(keydownObserver) {
  const [diff, setDiff] = useState([])
  const [pathMenu, setMenu] = useState([])
  const [pos, setPos] = useState(0)
  const { hash, setPath } = useCommits(keydownObserver)

  useEffect(() => {
    hash && loadDiff(hash, pathMenu[pos]).then(res => {
        res.menu && setMenu(res.menu)
        res.diff && setDiff(res.diff) 
    })
  }, [hash])

  useEffect(() => {
    const subscription = keydownObserver.subscribe(code => {
      switch (code) {
        case 'ArrowUp':
          return setPos(old => old + 1)
        case 'ArrowDown':
          return setPos(old => old - 1)
        case 'Enter':
          return setPath(pathMenu[pos] || "")
      }
    });
    return subscription.unsubscribe
  }, [])
  // how to show which one is currently chosen?
  // - text difference? aka add * to current chosen
  return { diff, pathMenu }
}

function Frame() {
  const [keydownObserver, setObserver] = useState(of())
  const { diff, pathMenu } = useDiff(keydownObserver);
  const fadeStyle = useSpring({
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

  useEffect(() => setObserver(observeKeydown()), [])

  console.log("res", diff, pathMenu)
  const longestLineLen = Math.max(...diff.map(line => line.length))
  return (
    <Fragment>
      <animated.textarea 
        style={fadeStyle} 
        // rows and cols padded to avoid scrolling + wrapping
        rows={diff.length + 1}
        cols={longestLineLen + 5}
        value={diff}
        readOnly 
      />
      {/* still allow a user to click on menu?
          thinking it would fire a keydown event to trigger above
          - throttle might be an issue though
        */
        pathMenu.map(path => (
          <div>
            {filename}
          </div>
        ))}
    </Fragment>
  )
}

export default function Entry() {
  return (
    <div className={styles.container}>
      <Head>
        <title>ripthebuild</title>
      </Head>
      <main className={styles.main}>
        <Frame />
      </main>
    </div>
  )
}
