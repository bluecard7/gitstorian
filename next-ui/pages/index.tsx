import Head from 'next/head'
import Image from 'next/image'
import { Fragment, useRef, useCallback, useEffect, useState } from 'react'
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
  const [hashPos, setHashPos] = useState(-1)
  const hashPosRef = useRef(-1)
  
  const menu = useRef([])
  const [diff, setDiff] = useState([])
  
  const [pagePath, setPagePath] = useState("")
  const [readPath, setReadPath] = useState("")
  
  const flip = (order: string): Promise<string[]> => {
    const hash = hashes.current[hashPosRef.current]
    return loadPage(order, hash, pagePath)
  }
  const updateHashPos = (pos: number) => {
    hashPosRef.current = pos
    setHashPos(pos)
  }
  const prepend = (page: string[]) => {
    hashes.current = page.concat(hashes.current)
    updateHashPos(page.length - 1)
  }
  const append = (page: string[]) => {
    hashes.current = hashes.current.concat(page)  
    updateHashPos(hashPosRef.current + 1)
  }
 
  useEffect(() => {
    flip("next").then(append)
    const subscription = observeKeydown().subscribe(code => {
      const currHashPos = hashPosRef.current;
      if (code === 'ArrowLeft') {
        if (currHashPos === 0) {
          flip("prev").then(prepend)
        } else {
          updateHashPos(currHashPos - 1) 
        }
      }
      if (code === 'ArrowRight') {
        if (currHashPos === hashes.current.length - 1) {
          flip("next").then(append)
        } else {
          updateHashPos(currHashPos + 1) 
        }
      }
      // always reset for now, but not if there's a pagePath?
      setReadPath("")
    });
    return subscription?.unsubscribe
  }, [])
  
  useEffect(() => {
    // pagePath && ...push onto traversal stack?
    console.log("page path set, i would do something")
  }, [pagePath])

  useEffect(() => {
    const hash = hashes.current[hashPosRef.current]
    hash && loadDiff(hash, readPath).then(res => {
        menu.current = res.pathMenu || []
        setDiff(res.diff)
    })
  }, [hashPos, readPath])

  return {
    menu: menu.current,
    diff,
    readPath,
    setReadPath,
    setPagePath,
  }
}

// todo: push + start new traversal if pagePath set
// todo: resolve edited paths in the backend
//   - ex: perf/{ => map}/perf.js -> perf/map/perf.js in response
// todo: copy filesystem menu view from gitlab?
// todo: feel cramped in diff view, have to pad outside of this component?
export default function Frame() {
  const { diff, menu, readPath, setReadPath, setPagePath } = useCommits();
  const clickCount = useRef(0)
  
  const rowStyle = (line: string): string => {
    switch (line[0]) {
      case "+": return styles['row-add']
      case "-": return styles['row-remove']
    } 
    return ""
  }

  const buttonStyle = (path: string): string => {
    let clickedColor;
    switch(clickCount.current) {
      case 1: clickedColor = styles['read-path']; break
      case 2: clickedColor = styles['flip-path']
    }
    const clickedStyle = path === readPath ? clickedColor : ''
    return `${styles['menu-button']} ${clickedStyle} `
  }
  
  const resetPaths = () => {
    setReadPath("")
    setPagePath("")
  }
  
  const selectPath = (path: string) => {
    if (clickCount.current === 0 || path !== readPath) {
      setReadPath(path)
      clickCount.current = 1
      return
    }
    if (clickCount.current === 1) {
      setPagePath(path)
      clickCount.current = 2
      return
    }
    if (clickCount.current === 2) {
      resetPaths()
      clickCount.current = 0
    }
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>ripthebuild</title>
      </Head>
      <main className={styles.main}>
        <div className={styles.menu}>
          {menu.map((path, pos) => (
            <button key={path}
              className={buttonStyle(path)}
              onClick={() => selectPath(path)} 
            >
              {path}
            </button>
          ))}
        </div>
        <table className={styles.diffview}>
          <tbody>
            {diff.map(line => {
              const statLine = line.split("|")
              return statLine.length === 2 ? (
                <tr>
                  <td>
                    <span className={styles.code}>
                      {statLine[0]}
                    </span>
                  </td> 
                  <td>
                    <span className={styles.code}>
                    | {statLine[1]}
                    </span>
                  </td>
                </tr>
              ) : (
                <tr className={rowStyle(line)}>
                  <span className={styles.code}>{line}</span>
                </tr>
              )
            })}
          </tbody>
        </table>
      </main>
    </div>
  )
}
