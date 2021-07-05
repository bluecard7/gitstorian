import Head from 'next/head'
import Image from 'next/image'
import { Fragment, useRef, useCallback, useEffect, useState } from 'react'
// import { useSpring, animated } from 'react-spring'
import { of, fromEvent } from 'rxjs'
import { filter, map, throttleTime } from 'rxjs/operators'
import styles from '../styles/Home.module.css'

const baseURL = 'http://localhost:8081'
const observeKeydown = () => fromEvent(document, 'keydown')
  .pipe(
    throttleTime(200),
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

function useCommits() {
  const hashes = useRef([])
  const path = useRef("")
  const setPagePath = (newPath: string) => (path.current = newPath)

  const [pos, setPos] = useState(-1)
  const posRef = useRef(-1)

  function updatePos(value: number) {
    posRef.current = value
    setPos(value)
  }

  // todo: issue, once reaching end, concats first page to end
  // similar situation going backwards
  // todo: want numbering of commits to combat ^?
  useEffect(() => {
    // get the first page
    loadPage("next").then(page => {
      hashes.current = page
      updatePos(0)
    })
    const subscription = observeKeydown().subscribe(code => {
      const currPos = posRef.current
      switch (code) {
        case 'ArrowLeft':
          currPos > 0 && updatePos(currPos - 1)
          currPos === 0 && loadPage('prev', hashes.current[currPos], path.current).then(page => {
            hashes.current = page.concat(hashes.current)
            updatePos(page.length - 1)
          })
          break
        case 'ArrowRight':
          const last = hashes.current.length - 1
          currPos < last && updatePos(currPos + 1)
          currPos === last && loadPage('next', hashes.current[currPos], path.current).then(page => {
            hashes.current = hashes.current.concat(page)  
            updatePos(currPos + 1)
          })
      }
    });
    return subscription?.unsubscribe
  }, [])
  return { hash: hashes.current[pos], setPagePath }
}

function useDiff() {
  const menu = useRef([])
  const [diff, setDiff] = useState([])
  const [pos, setPos] = useState(0)
  const posRef = useRef(0)
  // setPath is bad name, more like specifyPage, narrowPage??
  const { hash, setPagePath } = useCommits()
  
  const [path, setPath] = useState("")

  function updatePos(newPos: number) {
    if (newPos < 0 || newPos === menu.current.length) return 
    posRef.current = newPos
    setPos(newPos)
  }

  useEffect(() => {
    hash && loadDiff(hash, path).then(res => {
        menu.current = res.pathMenu || []
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
          setPagePath(menu.current[currPos] || "")
      }
    });
    return subscription?.unsubscribe
  }, [])
  return { diff, menu: menu.current, menuPos: posRef.current }
}

// todo: how to handle path-specific searches?
// - have a "confirm" that resets hashes to a new set of 
//  pages that only involve the specified path?
//    could be hover, then click
// - stack of searches?
function Frame() {
  const { diff, menu, menuPos } = useDiff();
  // unused
  /*const fadeStyle = useSpring({
    from: { opacity: 0.5 },
    to: { opacity: 1 },
    config: { 
      mass: 1, 
      tension: 280, 
      friction: 120,
      frequency: 2,
    },
    reset: true,
    })*/

  function rowStyle(line: string): object {
    switch (line[0]) {
      case "+": return { background: "#99ff99" }
      case "-": return { background: "#ff9999" }
    } 
    return {}
  }

  return (
    <Fragment>
      <table>
        <tbody>
          {diff.map(line => (
            <tr style={rowStyle(line)} >
              {line}
            </tr>
          ))}
        </tbody>
      </table>
      {menu.map((path, pos) => (
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
