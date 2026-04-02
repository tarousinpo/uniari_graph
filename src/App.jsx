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

const MAX_TITLE_LENGTH = 50

function ImageDropZone({ index, imageUrl, onImageChange }) {
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
      className={`drop-zone ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current.click()}
      title={`${index + 1}位の画像`}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={`${index + 1}位`} className="drop-preview" />
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

function PieChart({ data, images, title }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!data || data.length === 0) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    const TITLE_H = 52
    const cx = W / 2
    const cy = TITLE_H + (H - TITLE_H) / 2
    const R = Math.min(W, H - TITLE_H) * 0.38

    const total = data.reduce((s, d) => s + d.value, 0)
    if (total === 0) return

    ctx.clearRect(0, 0, W, H)

    // Draw background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)

    // Draw title
    if (title) {
      ctx.font = `bold ${Math.max(16, Math.round(W * 0.042))}px "Helvetica Neue", Arial, sans-serif`
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

        const scale = (R * 2) / Math.min(img.width, img.height)
        const dw = img.width * scale
        const dh = img.height * scale
        ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh)
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

    // Draw percentage labels
    startAngle = -Math.PI / 2
    data.forEach((item, i) => {
      const { sliceAngle } = sliceAngles[i]
      const midAngle = startAngle + sliceAngle / 2
      const pct = ((item.value / total) * 100).toFixed(1)

      const labelR = R * 0.65
      const lx = cx + labelR * Math.cos(midAngle)
      const ly = cy + labelR * Math.sin(midAngle)

      ctx.font = 'bold 13px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'

      if (sliceAngle > 0.15) {
        ctx.shadowColor = 'rgba(0,0,0,0.7)'
        ctx.shadowBlur = 4
        ctx.fillStyle = '#fff'
        ctx.fillText(`${pct}%`, lx, ly)
        ctx.shadowBlur = 0
      }

      startAngle += sliceAngle
    })
  }, [data, images, title])

  return <canvas ref={canvasRef} width={480} height={540} className="pie-canvas" />
}

function App() {
  const [rows, setRows] = useState(DEFAULT_ROWS)
  const [graphTitle, setGraphTitle] = useState('')
  const [chartData, setChartData] = useState(null)
  const [imageUrls, setImageUrls] = useState([null, null, null, null])
  const [loadedImages, setLoadedImages] = useState([null, null, null, null])
  const [error, setError] = useState('')

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
            <h2>上位4名の画像 <span className="hint">（ドラッグ＆ドロップ または クリック）</span></h2>
            <div className="drop-grid">
              {[0, 1, 2, 3].map(i => (
                <ImageDropZone
                  key={i}
                  index={i}
                  imageUrl={imageUrls[i]}
                  onImageChange={handleImageChange}
                />
              ))}
            </div>
          </section>

          {error && <p className="error">{error}</p>}
          <button className="btn-generate" onClick={handleGenerate}>📊 円グラフを作成</button>
        </div>

        <div className="right-panel">
          {chartData ? (
            <>
              <PieChart data={chartData} images={chartImages} title={graphTitle} />
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
