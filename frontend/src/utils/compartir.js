import html2canvas from 'html2canvas'

export async function captureAndShare(element, filename = 'billar') {
  const canvas = await html2canvas(element, {
    backgroundColor: '#0f172a',
    scale: 2,
    useCORS: true,
    logging: false,
    allowTaint: true,
  })

  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) { reject(new Error('No se pudo generar la imagen')); return }

      const file = new File([blob], `${filename}.png`, { type: 'image/png' })

      if (navigator.share && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Billar Pool' })
          resolve('shared')
          return
        } catch (e) {
          if (e.name === 'AbortError') { resolve('cancelled'); return }
        }
      }

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      resolve('downloaded')
    }, 'image/png')
  })
}
