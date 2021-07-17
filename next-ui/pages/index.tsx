import Head from 'next/head'
import Image from 'next/image'
import { Fragment, useRef, useCallback, useEffect, useState } from 'react'
import { of, fromEvent } from 'rxjs'
import { filter, map, throttleTime } from 'rxjs/operators'
import styles from '../styles/Home.module.css'

const baseURL = 'http://localhost:8081'
const urlify = (parts: string[]): string => parts.filter(Boolean).join('/')
const keydownObserver = typeof window !== 'undefined' && fromEvent(document, 'keydown')
  .pipe(
    throttleTime(200),
    map(e => e.code),
    filter(Boolean),
  )

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
): Promise<{ diff: string[], pathMenu: string[]}> {
  const res = await fetchData([baseURL,'diffs', hash, path])
  return res.json()
}

function useCommits() {
  const hashes = useRef([])
  const [hashPos, setHashPos] = useState(-1)
  const [menu, setMenu] = useState([])
  const [diff, setDiff] = useState([])
  const [readPath, setReadPath] = useState("")
  
  const append = (page: string[]) => {
    hashes.current = hashes.current.concat(page)  
    setHashPos(hashPos + 1)
  }
  const prepend = (page: string[]) => {
    hashes.current = page.concat(hashes.current)
    setHashPos(page.length - 1)
  }
  const flip = (order: string): Promise<string[]> => {
    const hash = hashes.current[hashPos]
    const insert = order === "next" ? append : prepend
    return loadPage(order, hash).then(insert)
  }

  useEffect(() => { flip("next") }, [])
 
  useEffect(() => {
    const subscription = keydownObserver.subscribe(code => {
      if (code === 'ArrowLeft') {
        if (hashPos === 0) {
          flip("prev")
        } else {
          setHashPos(hashPos - 1) 
        }
      }
      if (code === 'ArrowRight') {
        if (hashPos === hashes.current.length - 1) {
          flip("next")
        } else {
          setHashPos(hashPos + 1) 
        }
      }
      setReadPath("")
    });
    return () => subscription.unsubscribe()
  }, [hashPos])

  useEffect(() => {
    const hash = hashes.current[hashPos]
    hash && loadDiff(hash, readPath).then(res => {
        setMenu(res.pathMenu || [])
        setDiff(res.diff || [])
    })
  }, [hashPos, readPath])

  return {
    menu,
    diff,
    readPath,
    setReadPath,
  }
}

// todo: resolve edited paths in the backend
//   - ex: perf/{ => map}/perf.js -> perf/map/perf.js in response
//   - resolve truncated paths
// todo: copy filesystem menu view from gitlab?
// todo: feel cramped in diff view, have to pad outside of this component?
export default function Frame() {
  const { 
    diff, 
    menu, 
    readPath, 
    setReadPath, 
  } = useCommits();
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
  
  const selectPath = (path: string) => {
    if (clickCount.current === 0 || path !== readPath) {
      setReadPath(path)
      clickCount.current = 1
      return
    }
    if (clickCount.current === 1) {
      setReadPath("")
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
