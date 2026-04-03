import { useState, useRef, useCallback, useEffect } from 'react'
import './App.css'

const COLORS = [
  '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
  '#9966FF', '#FF9F40', '#C9CBCF', '#7BC8A4',
  '#E7191E', '#1A78C2', '#F5A623', '#7ED321',
]

const DEFAULT_ROWS = [
  { name: 'Aさん', value: '' },
  { name: 'Bさん', value: '' },
  { name: 'Cさん', value: '' },
  { name: 'Dさん', value: '' },
]

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  const result = []
  for (const line of lines) {
    if (!line.trim()) continue
    const parts = line.split(/[,\t]/)
    if (parts.length < 2) continue
    const name = parts[0].trim()
    const val = parseFloat(parts[1].trim())
    if (!name || isNaN(val) || val <= 0) continue
    result.push({ name, value: String(val) })
  }
  return result
}

const MAX_TITLE_LENGTH = 50
const MAX_LABEL_NAME_LENGTH = 5
const LARGE_SLICE_THRESHOLD = 0.28
const MEDIUM_SLICE_THRESHOLD = 0.15

const DEFAULT_TRANSFORM = { scale: 1, offsetX: 0, offsetY: 0 }

function ImageDropZone({ index, imageUrl, onImageChange, isEditing, onEditToggle }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const loadFile = useCallback((file) => {
    if (file && file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      onImageChange(index, url)
    }
  }, [index, onImageChange])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    loadFile(e.dataTransfer.files[0])
  }, [loadFile])

  const handleChange = (e) => {
    loadFile(e.target.files[0])
    // Reset so the same file can be re-selected
    e.target.value = ''
  }

  return (
    <div
      className={`drop-zone ${dragging ? 'dragging' : ''} ${isEditing ? 'editing' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current.click()}
      title={`${index + 1}位の画像`}
    >
      {imageUrl ? (
        <>
          <img src={imageUrl} alt={`${index + 1}位`} className="drop-preview" />
          <button
            className="btn-edit-image"
            onClick={(e) => { e.stopPropagation(); onEditToggle(index) }}
            title="画像の表示を調整"
          >⚙</button>
        </>
      ) : (
        <span className="drop-label">🖼 {index + 1}位<br />ドロップ or クリック</span>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
    </div>
  )
}

function ImageTransformEditor({ index, transform, onChange, onReset, onClose }) {
  return (
    <div className="image-transform-editor">
      <div className="transform-header">
        <span>{index + 1}位の画像を調整</span>
        <button className="btn-transform-close" onClick={onClose}>✕</button>
      </div>
      <div className="transform-row">
        <label>ズーム</label>
        <input
          type="range" min="0.3" max="4" step="0.05"
          value={transform.scale}
          onChange={e => onChange(index, 'scale', parseFloat(e.target.value))}
        />
        <span className="transform-value">{transform.scale.toFixed(2)}x</span>
      </div>
      <div className="transform-row">
        <label>横位置</label>
        <input
          type="range" min="-100" max="100" step="1"
          value={transform.offsetX}
          onChange={e => onChange(index, 'offsetX', parseFloat(e.target.value))}
        />
        <span className="transform-value">{transform.offsetX > 0 ? '+' : ''}{transform.offsetX}</span>
      </div>
      <div className="transform-row">
        <label>縦位置</label>
        <input
          type="range" min="-100" max="100" step="1"
          value={transform.offsetY}
          onChange={e => onChange(index, 'offsetY', parseFloat(e.target.value))}
        />
        <span className="transform-value">{transform.offsetY > 0 ? '+' : ''}{transform.offsetY}</span>
      </div>
      <button
        className="btn-transform-reset"
        onClick={() => onReset(index)}
      >リセット</button>
    </div>
  )
}

const CANVAS_W = 720
const CANVAS_H = 540
const LEGEND_X = 490
const LEGEND_ROW_H = 36
const LEGEND_THUMB_SIZE = 28
const LEGEND_SWATCH_GAP = 7
const POP_FONT = '"M PLUS Rounded 1c", "Hiragino Maru Gothic ProN", "BIZ UDPGothic", sans-serif'
// Medal colors for ranks 1-4, gray for the rest
const RANK_BADGE_COLORS = ['#E6B800', '#888888', '#C07830', '#4e9af1']

function PieChart({ data, images, transforms, title }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!data || data.length === 0) return
    const canvas = canvasRef.current
    let cancelled = false

    const draw = () => {
      if (cancelled || !canvas) return
      const ctx = canvas.getContext('2d')
      const W = canvas.width
      const H = canvas.height
      const TITLE_H = 52
      // Pie occupies the left portion of the canvas
      const PIE_AREA_W = LEGEND_X - 10
      const cx = PIE_AREA_W / 2
      const cy = TITLE_H + (H - TITLE_H) / 2
      const R = Math.min(PIE_AREA_W, H - TITLE_H) * 0.42

      const total = data.reduce((s, d) => s + d.value, 0)
      if (total === 0) return

      ctx.clearRect(0, 0, W, H)

      // Draw background
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, W, H)

      // Draw title (centered over the full canvas)
      if (title) {
        ctx.font = `bold ${Math.max(16, Math.round(W * 0.032))}px ${POP_FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = '#222'
        ctx.fillText(title, W / 2, TITLE_H / 2)
      }

      let startAngle = -Math.PI / 2
      const sliceAngles = []

      data.forEach((item, i) => {
        const sliceAngle = (item.value / total) * 2 * Math.PI
        sliceAngles.push({ startAngle, sliceAngle })

        const img = images[i]
        if (img) {
          ctx.save()
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.arc(cx, cy, R, startAngle, startAngle + sliceAngle)
          ctx.closePath()
          ctx.clip()

          const t = (transforms && transforms[i]) || DEFAULT_TRANSFORM
          const baseScale = (R * 2) / Math.min(img.width, img.height)
          const finalScale = baseScale * t.scale
          const dw = img.width * finalScale
          const dh = img.height * finalScale
          const ox = (t.offsetX / 100) * R
          const oy = (t.offsetY / 100) * R
          ctx.drawImage(img, cx - dw / 2 + ox, cy - dh / 2 + oy, dw, dh)
          ctx.restore()
        } else {
          ctx.fillStyle = COLORS[i % COLORS.length]
          ctx.beginPath()
          ctx.moveTo(cx, cy)
          ctx.arc(cx, cy, R, startAngle, startAngle + sliceAngle)
          ctx.closePath()
          ctx.fill()
        }

        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, R, startAngle, startAngle + sliceAngle)
        ctx.closePath()
        ctx.stroke()

        startAngle += sliceAngle
      })

      // Draw name + value labels inside pie slices
      startAngle = -Math.PI / 2
      data.forEach((item, i) => {
        const { sliceAngle } = sliceAngles[i]
        const midAngle = startAngle + sliceAngle / 2

        const labelR = R * 0.65
        const lx = cx + labelR * Math.cos(midAngle)
        const ly = cy + labelR * Math.sin(midAngle)

        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.shadowColor = 'rgba(0,0,0,0.75)'
        ctx.shadowBlur = 4
        ctx.fillStyle = '#fff'

        const valText = item.value.toLocaleString()
        if (sliceAngle > LARGE_SLICE_THRESHOLD) {
          // Large slice: truncated name on top line, value below
          const displayName = item.name.length > MAX_LABEL_NAME_LENGTH
            ? item.name.slice(0, MAX_LABEL_NAME_LENGTH - 1) + '…'
            : item.name
          ctx.font = `bold 13px ${POP_FONT}`
          ctx.fillText(displayName, lx, ly - 9)
          ctx.fillText(valText, lx, ly + 9)
        } else if (sliceAngle > MEDIUM_SLICE_THRESHOLD) {
          // Medium slice: value only
          ctx.font = `bold 13px ${POP_FONT}`
          ctx.fillText(valText, lx, ly)
        }
        // Slices below MEDIUM_SLICE_THRESHOLD get no label (too small to show text legibly)

        ctx.shadowBlur = 0
        startAngle += sliceAngle
      })

      // Draw ranked legend list on the right side of the canvas
      const legendStartY = TITLE_H + 20
      const legendMaxW = W - LEGEND_X - 12

      ctx.shadowBlur = 0

      data.forEach((item, i) => {
        const rowY = legendStartY + i * LEGEND_ROW_H
        if (rowY + LEGEND_ROW_H > H) return  // don't overflow canvas

        const img = images[i]
        const isTopFour = i < 4
        const thumbCx = LEGEND_X + LEGEND_THUMB_SIZE / 2
        const thumbCy = rowY + LEGEND_ROW_H / 2
        const rankColor = RANK_BADGE_COLORS[i] ?? '#999999'

        if (isTopFour && img) {
          // Draw circular image thumbnail
          ctx.save()
          ctx.beginPath()
          ctx.arc(thumbCx, thumbCy, LEGEND_THUMB_SIZE / 2, 0, Math.PI * 2)
          ctx.closePath()
          ctx.clip()
          const scale = LEGEND_THUMB_SIZE / Math.min(img.width, img.height)
          ctx.drawImage(
            img,
            thumbCx - (img.width * scale) / 2,
            thumbCy - (img.height * scale) / 2,
            img.width * scale,
            img.height * scale
          )
          ctx.restore()
          // Medal-colored circle border
          ctx.strokeStyle = rankColor
          ctx.lineWidth = 2.5
          ctx.beginPath()
          ctx.arc(thumbCx, thumbCy, LEGEND_THUMB_SIZE / 2, 0, Math.PI * 2)
          ctx.stroke()
        } else {
          // Colored square swatch for items without an image or rank > 4
          ctx.fillStyle = COLORS[i % COLORS.length]
          ctx.beginPath()
          const thumbY = thumbCy - LEGEND_THUMB_SIZE / 2
          if (ctx.roundRect) {
            ctx.roundRect(LEGEND_X, thumbY, LEGEND_THUMB_SIZE, LEGEND_THUMB_SIZE, 4)
          } else {
            ctx.rect(LEGEND_X, thumbY, LEGEND_THUMB_SIZE, LEGEND_THUMB_SIZE)
          }
          ctx.fill()
        }

        // Rank + name + value text
        const textX = LEGEND_X + LEGEND_THUMB_SIZE + LEGEND_SWATCH_GAP
        ctx.font = `bold 13px ${POP_FONT}`
        ctx.textBaseline = 'middle'
        ctx.textAlign = 'left'

        const rankStr = `${i + 1}.`
        const valStr = `　${item.value.toLocaleString()}`
        const rankW = ctx.measureText(rankStr + ' ').width
        const valW = ctx.measureText(valStr).width
        const nameAvailW = legendMaxW - LEGEND_THUMB_SIZE - LEGEND_SWATCH_GAP - rankW - valW

        let displayName = item.name
        if (ctx.measureText(displayName).width > nameAvailW) {
          while (displayName.length > 1 && ctx.measureText(displayName + '…').width > nameAvailW) {
            displayName = displayName.slice(0, -1)
          }
          displayName = displayName + '…'
        }

        // Rank number in medal color
        ctx.fillStyle = rankColor
        ctx.fillText(rankStr, textX, thumbCy)

        // Name + value in dark color
        ctx.fillStyle = '#222'
        ctx.fillText(' ' + displayName + valStr, textX + rankW, thumbCy)
      })
    }

    document.fonts.ready.then(() => { if (!cancelled) draw() })
    return () => { cancelled = true }
  }, [data, images, transforms, title])

  return <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} className="pie-canvas" />
}

function App() {
  const [rows, setRows] = useState(DEFAULT_ROWS)
  const [graphTitle, setGraphTitle] = useState('')
  const [chartData, setChartData] = useState(null)
  const [imageUrls, setImageUrls] = useState([null, null, null, null])
  const [loadedImages, setLoadedImages] = useState([null, null, null, null])
  const [imageTransforms, setImageTransforms] = useState(
    () => Array.from({ length: 4 }, () => ({ ...DEFAULT_TRANSFORM }))
  )
  const [editingIndex, setEditingIndex] = useState(null)
  const [error, setError] = useState('')
  const [csvError, setCsvError] = useState('')
  const [copied, setCopied] = useState(false)
  const csvInputRef = useRef(null)

  const handleCsvUpload = (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    setCsvError('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target.result)
      if (parsed.length === 0) {
        setCsvError('CSVを読み込めませんでした。「名前,数値」の2列形式か確認してください。')
        return
      }
      setRows(parsed)
    }
    reader.readAsText(file, 'UTF-8')
  }

  const handleCellChange = (index, field, value) => {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  const addRow = () => setRows(prev => [...prev, { name: '', value: '' }])

  const removeRow = (index) => {
    if (rows.length <= 1) return
    setRows(prev => prev.filter((_, i) => i !== index))
  }

  const handleImageChange = useCallback((index, newUrl) => {
    setImageUrls(prev => {
      const next = [...prev]
      // Revoke previous object URL to avoid memory leak
      if (next[index]) {
        URL.revokeObjectURL(next[index])
      }
      next[index] = newUrl
      return next
    })
    setImageTransforms(prev => {
      const next = [...prev]
      next[index] = { ...DEFAULT_TRANSFORM }
      return next
    })
    const img = new Image()
    img.src = newUrl
    img.onload = () => {
      setLoadedImages(prev => {
        const next = [...prev]
        next[index] = img
        return next
      })
    }
  }, [])

  const handleTransformChange = useCallback((index, field, value) => {
    setImageTransforms(prev => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }, [])

  const handleTransformReset = useCallback((index) => {
    setImageTransforms(prev => {
      const next = [...prev]
      next[index] = { ...DEFAULT_TRANSFORM }
      return next
    })
  }, [])

  const handleEditToggle = useCallback((index) => {
    setEditingIndex(prev => prev === index ? null : index)
  }, [])

  // Revoke all object URLs on unmount
  useEffect(() => {
    return () => {
      imageUrls.forEach(url => { if (url) URL.revokeObjectURL(url) })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGenerate = () => {
    setError('')
    const parsed = rows
      .map(r => ({ name: r.name.trim(), value: parseFloat(r.value) }))
      .filter(r => r.name && !isNaN(r.value) && r.value > 0)

    if (parsed.length < 2) {
      setError('有効なデータを2件以上入力してください。')
      return
    }

    parsed.sort((a, b) => b.value - a.value)
    setChartData(parsed)
  }

  const handleDownload = () => {
    const canvas = document.querySelector('.pie-canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.download = 'pie-chart.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  const listText = chartData
    ? chartData.map((item, i) => `${i + 1}位\t${item.name}\t${item.value.toLocaleString()}`).join('\n')
    : ''

  const handleCopy = () => {
    if (!listText) return
    navigator.clipboard.writeText(listText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const chartImages = chartData
    ? chartData.slice(0, 4).map((_, i) => loadedImages[i] || null)
    : loadedImages

  return (
    <div className="app">
      <h1>🥧 円グラフ作成</h1>

      <div className="main-layout">
        <div className="left-panel">
          <section className="section">
            <h2>グラフタイトル</h2>
            <input
              type="text"
              className="title-input"
              value={graphTitle}
              onChange={e => setGraphTitle(e.target.value)}
              placeholder="例：推しメン投票結果"
              maxLength={MAX_TITLE_LENGTH}
            />
          </section>

          <section className="section">
            <h2>データ入力</h2>
            <div className="csv-upload-row">
              <button className="btn-csv" onClick={() => csvInputRef.current.click()}>
                📂 CSVで読み込む
              </button>
              <span className="hint">（名前,数値 の2列）</span>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                style={{ display: 'none' }}
                onChange={handleCsvUpload}
              />
            </div>
            {csvError && <p className="error">{csvError}</p>}
            <table className="data-table">
              <thead>
                <tr>
                  <th>名前</th>
                  <th>数値</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td>
                      <input
                        type="text"
                        value={row.name}
                        onChange={e => handleCellChange(i, 'name', e.target.value)}
                        placeholder="名前"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={row.value}
                        onChange={e => handleCellChange(i, 'value', e.target.value)}
                        placeholder="0"
                        min="0"
                      />
                    </td>
                    <td>
                      <button className="btn-remove" onClick={() => removeRow(i)} title="削除">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="btn-add" onClick={addRow}>＋ 行を追加</button>
          </section>

          <section className="section">
            <h2>上位4名の画像 <span className="hint">（ドラッグ＆ドロップ または クリック / ⚙で位置調整）</span></h2>
            <div className="drop-grid">
              {[0, 1, 2, 3].map(i => (
                <ImageDropZone
                  key={i}
                  index={i}
                  imageUrl={imageUrls[i]}
                  onImageChange={handleImageChange}
                  isEditing={editingIndex === i}
                  onEditToggle={handleEditToggle}
                />
              ))}
            </div>
            {editingIndex !== null && imageUrls[editingIndex] && (
              <ImageTransformEditor
                index={editingIndex}
                transform={imageTransforms[editingIndex]}
                onChange={handleTransformChange}
                onReset={handleTransformReset}
                onClose={() => setEditingIndex(null)}
              />
            )}
          </section>

          {error && <p className="error">{error}</p>}
          <button className="btn-generate" onClick={handleGenerate}>📊 円グラフを作成</button>
        </div>

        <div className="right-panel">
          {chartData ? (
            <>
              <PieChart data={chartData} images={chartImages} transforms={imageTransforms} title={graphTitle} />
              <div className="legend">
                {chartData.map((item, i) => (
                  <div key={i} className="legend-item">
                    <span
                      className="legend-color"
                      style={{
                        background: imageUrls[i]
                          ? `url(${imageUrls[i]}) center/cover`
                          : COLORS[i % COLORS.length],
                        border: '1px solid #ccc'
                      }}
                    />
                    <span className="legend-rank">#{i + 1}</span>
                    <span className="legend-name">{item.name}</span>
                    <span className="legend-value">{item.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <button className="btn-download" onClick={handleDownload}>⬇ PNG でダウンロード</button>
              <div className="copy-list-section">
                <div className="copy-list-header">
                  <span className="copy-list-title">グラフ使用データ一覧</span>
                  <button className="btn-copy" onClick={handleCopy}>
                    {copied ? '✓ コピーしました' : '📋 コピー'}
                  </button>
                </div>
                <textarea
                  className="copy-list-area"
                  readOnly
                  value={listText}
                />
              </div>
            </>
          ) : (
            <div className="placeholder">
              <p>左のフォームでデータを入力して<br />「円グラフを作成」を押してください</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
