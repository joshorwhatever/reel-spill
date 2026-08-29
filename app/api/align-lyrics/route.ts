import { NextResponse } from 'next/server'

// Extends Vercel/Next.js execution limit so audio processing doesn't time out
export const maxDuration = 60

export async function POST(req: Request) {
  try {
    // 1. Check for missing API Key early
    if (!process.env.OPENAI_API_KEY) {
      console.error('Missing OPENAI_API_KEY in environment variables.')
      return NextResponse.json(
        { error: 'Server configuration error: Missing OPENAI_API_KEY.' },
        { status: 500 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const prompt = formData.get('prompt') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 })
    }

    const openAiFormData = new FormData()
    // 2. Explicitly pass file.name so OpenAI recognizes the audio extension (.mp3, .wav, etc.)
    openAiFormData.append('file', file, file.name || 'audio.mp3')
    openAiFormData.append('model', 'whisper-1')
    openAiFormData.append('response_format', 'verbose_json')
    openAiFormData.append('timestamp_granularities[]', 'word')
    openAiFormData.append('timestamp_granularities[]', 'segment')

    if (prompt) {
      openAiFormData.append('prompt', prompt)
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: openAiFormData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('OpenAI Raw Error:', errorText)
      return NextResponse.json(
        { error: `OpenAI API error: ${errorText}` },
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