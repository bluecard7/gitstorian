import Head from 'next/head'
import Image from 'next/image'
import { Fragment, useRef, useCallback, useEffect, useState } from 'react'
import { useSpring, animated } from 'react-spring'
import { of, fromEvent } from 'rxjs'
import { filter, map, throttleTime } from 'rxjs/operators'
import styles from '../styles/Home.module.css'

const baseURL = 'http://localhost:8081'
const observeKeydown = () => fromEvent(document, 'keydown')
  .pipe(
    throttleTime(300),
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

// todo: file renames result in both versions being appended w/ =>
// handle in backend
async function loadDiff(
  hash: string = "", 
  path: string = ""
): Promise<{ diff: string[], pathMenu: string[]}> {
  const res = await fetchData([baseURL,'diffs', hash, path])
  return res.json()
}

// being used as base of useDiff, but these were designed to be complimentary
// separate + use in Frames?
function useCommits() {
  const hashes = useRef([])
  const [pos, setPos] = useState(-1)
  const posRef = useRef(-1)
  const [path, setPath] = useState("")

  function updatePos(value: number) {
    posRef.current = value
    setPos(value)
  }

  // todo: issue, once reaching end, concats first page to end
  // similar situation going backwards
  // may or may not be an issue, could just make hashes a fixed size and move with it
  // want numbering of commits?
  useEffect(() => {
    // get the first page
    loadPage("next").then(page => {
      hashes.current = page
      updatePos(0)
    })
    const subscription = observeKeydown().subscribe(code => {
      // todo: need to check if page is empty or not
      const currPos = posRef.current
      switch (code) {
        case 'ArrowLeft':
          currPos > 0 && updatePos(currPos - 1)
          currPos === 0 && loadPage('prev', hashes.current[currPos], path).then(page => {
            hashes.current = page.concat(hashes.current)
            updatePos(page.length - 1)
          })
          break
        case 'ArrowRight':
          const last = hashes.current.length - 1
          currPos < last && updatePos(currPos + 1)
          currPos === last && loadPage('next', hashes.current[currPos], path).then(page => {
            hashes.current = hashes.current.concat(page)  
            updatePos(currPos + 1)
          })
      }
    });
    return subscription?.unsubscribe
  }, [])
  return { hash: hashes.current[pos], setPath }
}

function useDiff() {
  const menu = useRef([])
  const [diff, setDiff] = useState([])
  const [pos, setPos] = useState(0)
  const posRef = useRef(0)
  // setPath is bad name, more like specifyPage, narrowPage??
  const { hash, setPath: setHashesPath } = useCommits()
  
  const [path, setPath] = useState("")

  function updatePos(newPos: number) {
    if (newPos < 0 || newPos === menu.current.length) return 
    posRef.current = newPos
    setPos(newPos)
  }

  useEffect(() => {
    // todo, instead need Enter key to specify path is to be used
    // like, a user is "selecting" once they nav through the menu
    // And once enter is hit, then loadDiff can use it to determine
    // what kind of diff is generated.
    // 
    // for now ignoring path
    // const path = selecting ? "" : menu.current[pos]
    hash && loadDiff(hash, path).then(res => {
        !path && (menu.current = res.pathMenu || [])
        setDiff(res.diff)
        !path && updatePos(0)
    })
  }, [hash, path])

  useEffect(() => {
    const subscription = observeKeydown().subscribe(code => {
      const currPos = posRef.current
      switch (code) {
        case 'ArrowUp':
          return updatePos(currPos - 1)
        case 'ArrowDown':
          return updatePos(currPos + 1)
        case 'Enter':
          setPath(menu.current[currPos])
          // todo: how to handle path-specific searches?
          // - have a "confirm" that resets hashes to a new set of 
          //  pages that only involve the specified path?
          // - stack of searches?
          return setHashesPath(menu.current[currPos] || "")
      }
    });
    return subscription?.unsubscribe
  }, [])
  console.log(menu.current[pos])
  // goin through menu cause animation to refresh, even though same diff
  return { diff, menu: menu.current, menuPos: posRef.current }
}

function Frame() {
  const { diff, menu, menuPos } = useDiff();
  const fadeStyle = useSpring({
    from: { opacity: 0.5 },
    to: { opacity: 1 },
    config: { 
      mass: 1, 
      tension: 280, 
      friction: 120,
      frequency: 2,
    },
    reset: true,
  })

  console.log(menu, menuPos)
  const longestLineLen = Math.max(...diff.map(line => line.length))
  return (
    <Fragment>
      <animated.textarea 
        style={fadeStyle} 
        // rows and cols padded to avoid scrolling + wrapping
        rows={diff.length + 1}
        cols={longestLineLen + 5}
        value={diff.join("\n")}
        readOnly 
      />
      {/* still allow a user to click on menu?
          thinking it would fire a keydown event to trigger above
          - throttle might be an issue though
        */
        menu.map((path, pos) => (
          <div key={path}>{path} {menuPos === pos && '*'}</div>
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
