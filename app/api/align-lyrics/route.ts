import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key is missing in environment variables' }, { status: 500 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'Audio file is required' }, { status: 400 })
    }

    // Forward the audio file directly to OpenAI's Whisper API endpoint using fetch
    const openaiFormData = new FormData()
    openaiFormData.append('file', file)
    openaiFormData.append('model', 'whisper-1')
    openaiFormData.append('response_format', 'verbose_json')
    openaiFormData.append('timestamp_granularities[]', 'segment')
    openaiFormData.append('timestamp_granularities[]', 'word')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: openaiFormData,
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`OpenAI API error: ${errText}`)
    }

    const transcription = await response.json()

    return NextResponse.json({
      segments: transcription.segments || [],
      words: transcription.words || [],
    })
  } catch (error: any) {
    console.error('Whisper Alignment Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to align audio with Whisper' },
      { status: 500 }
    )
  }
}