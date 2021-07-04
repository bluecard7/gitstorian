import Head from 'next/head'
import Image from 'next/image'
import { Fragment, useCallback, useEffect, useState } from 'react'
import { useSpring, animated } from 'react-spring'
import { fromEvent } from 'rxjs'
import { filter, map, throttleTime } from 'rxjs/operators'
import styles from '../styles/Home.module.css'

const baseURL = 'http://localhost:8081'
const keydownObserver = fromEvent(document, 'keydown')
  .pipe(
    throttleTime(500),
    map(e => e.code),
    filter(Boolean),
  )

const urlify = (parts: string[]): string => parts.filter(Boolean).join('/')
function fetchData(pieces: string[]): Promise<Response> {
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
): Promise<{ diff: string, menu: string[]}> {
  const res = await fetchData([baseURL,'diffs', hash, path])
  return data.json()
}

function useCommits() {
  const [hashes, setHashes] = useState([])
  const [pos, setPos] = useState(0)
  useEffect(() => {
    const subscription = keydownObserver.subscribe(code => {
      switch (code) {
        case 'ArrowLeft':
          if (pos === 0) {
            // instead of array, could try traversing a bin tree of hash pages
            loadPage('prev', hashes[pos]).then(page => {
              setHashes([...page, ...hashes])
              setPos(old => old - 1)
            })
          }
          return setPos(old => old - 1)
        case 'ArrowRight':
          if (pos + 1 === hashes.length) {
            loadPage('next', hashes[pos]).then(page => {
              setHashes([...hashes, ...page])
              setPos(old => old + 1)
            })
          }
          return setPos(old => old + 1)
      }
    });
    return subscription.unsubscribe
  }, [])

  // how do I provide a path to iterate on?
  // how/when to trigger fetch in subscription?
  return { hash: hashes[pos] }
}

/*function formatMenu(diff) {
  return diff.split('\n')
    .map(line => line.split('|'))
    .map(parts => parts.length === 2 && parts[0].trim())
    .filter(Boolean)
}*/

function useDiff() {
  const [pathMenu, setMenu] = useState([])
  const [pos, setPos] = useState(0)
  const { hash } = useCommits()
  useEffect(() => {
    const subscription = keydownObserver.subscribe(code => {
      switch (code) {
        case 'ArrowUp':
          return setMenuPos(pos => pos + 1)
        case 'ArrowDown':
          return setMenuPos(pos => pos - 1)
        case 'Enter':
        // todo: provide the menu through backend response
        // w/ the diff
          return // loadDiff(hash, pathMenu[pos]).then(
          // res => { setMenu(res.menu); setDiff(res.diff) }
          // )
      }
    });
    return subscription.unsubscribe
  }, [])

  // how to show which one is currently chosen?
  // - text difference? aka add * to current chosen
  return { diff, pathMenu }
}

function Frame() {
  const { diff, pathMenu } = useDiff();
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

  const lines = diff.split('\n')
  const longestLineLen = Math.max(...lines.map(line => line.length))
  
  return (
    <Fragment>
      <animated.textarea 
        style={fadeStyle} 
        // rows and cols padded to avoid scrolling + wrapping
        rows={lines.length + 1}
        cols={longestLineLen + 5}
        value={diff}
        readOnly 
      />
      {/* still allow a user to click on menu?
          thinking it would fire a keydown event to trigger above
          - throttle might be an issue though
        */
        menu.map(path => (
          <button onClick={() => loadDiff(hash, filename)}>
            {filename}
          </button>
        ))}
    </Fragment>
  )
}

export default () => {
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
