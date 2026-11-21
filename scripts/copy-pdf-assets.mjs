import { cp, mkdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = resolve(root, 'node_modules/pdfjs-dist')
const target = resolve(root, 'public/pdfjs')

await rm(target, { recursive: true, force: true })
await mkdir(target, { recursive: true })
await cp(resolve(source, 'cmaps'), resolve(target, 'cmaps'), { recursive: true })
await cp(resolve(source, 'standard_fonts'), resolve(target, 'standard_fonts'), { recursive: true })
console.log('Copied PDF.js CMaps and standard fonts.')
