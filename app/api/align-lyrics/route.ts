import { NextResponse } from 'next/server'

export const maxDuration = 60

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const prompt = formData.get('prompt') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
    }

    const whisperFormData = new FormData()
    whisperFormData.append('file', file, file.name || 'audio.mp3')
    whisperFormData.append('model', 'whisper-1')
    whisperFormData.append('response_format', 'verbose_json')
    whisperFormData.append('timestamp_granularities[]', 'word')
    whisperFormData.append('timestamp_granularities[]', 'segment')

    if (prompt) {
      whisperFormData.append('prompt', prompt)
    }

    // Default to local Docker container on port 8001 if WHISPER_API_URL is unset
    const targetEndpoint =
      process.env.WHISPER_API_URL || 'http://127.0.0.1:8001/v1/audio/transcriptions'
    const apiKey = process.env.OPENAI_API_KEY || 'local-whisper-key'

    const response = await fetch(targetEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: whisperFormData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Whisper Service Error:', errorText)
      return NextResponse.json(
        { error: `Whisper service error: ${errorText}` },
        { status: response.status }
      )
    }

    const transcription = await response.json()

    return NextResponse.json({
      segments: transcription.segments || [],
      words: transcription.words || [],
    })
  } catch (error: any) {
    console.error('Whisper alignment API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to align lyrics' },
      { status: 500 }
    )
  }
}