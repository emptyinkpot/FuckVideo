$ErrorActionPreference = "Stop"

$outDir = "E:\My Project\remotion-project\out"
$pptxPath = Join-Path $outDir "document-reveal-canva-editable.pptx"
$previewPath = Join-Path $outDir "document-reveal-canva-editable-preview.png"

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function RGB($hex) {
  $h = $hex.TrimStart("#")
  $r = [Convert]::ToInt32($h.Substring(0, 2), 16)
  $g = [Convert]::ToInt32($h.Substring(2, 2), 16)
  $b = [Convert]::ToInt32($h.Substring(4, 2), 16)
  return $r + ($g * 256) + ($b * 65536)
}

$scale = 0.75
function Px($value) { return [double]$value * $script:scale }

function Add-Rect($slide, $x, $y, $w, $h, $fill, $transparency = 0, $line = $null, $radius = $false) {
  $shapeType = if ($radius) { 5 } else { 1 }
  $s = $slide.Shapes.AddShape($shapeType, (Px $x), (Px $y), (Px $w), (Px $h))
  $s.Fill.Visible = -1
  $s.Fill.Solid()
  $s.Fill.ForeColor.RGB = RGB $fill
  $s.Fill.Transparency = [single]$transparency
  if ($null -eq $line) {
    $s.Line.Visible = 0
  } else {
    $s.Line.Visible = -1
    $s.Line.ForeColor.RGB = RGB $line.Color
    $s.Line.Weight = Px $line.Weight
    if ($line.Transparency -ne $null) { $s.Line.Transparency = [single]$line.Transparency }
  }
  return $s
}

function Add-Ellipse($slide, $x, $y, $w, $h, $fill, $transparency = 0, $line = $null) {
  $s = $slide.Shapes.AddShape(9, (Px $x), (Px $y), (Px $w), (Px $h))
  $s.Fill.Visible = -1
  $s.Fill.Solid()
  $s.Fill.ForeColor.RGB = RGB $fill
  $s.Fill.Transparency = [single]$transparency
  if ($null -eq $line) {
    $s.Line.Visible = 0
  } else {
    $s.Line.Visible = -1
    $s.Line.ForeColor.RGB = RGB $line.Color
    $s.Line.Weight = Px $line.Weight
    if ($line.Transparency -ne $null) { $s.Line.Transparency = [single]$line.Transparency }
  }
  return $s
}

function Add-Line($slide, $x1, $y1, $x2, $y2, $color, $weight = 1, $transparency = 0) {
  $s = $slide.Shapes.AddLine((Px $x1), (Px $y1), (Px $x2), (Px $y2))
  $s.Line.ForeColor.RGB = RGB $color
  $s.Line.Weight = Px $weight
  $s.Line.Transparency = [single]$transparency
  return $s
}

function Add-Text($slide, $text, $x, $y, $w, $h, $fontSize, $color, $bold = $false, $font = "Noto Serif SC") {
  $s = $slide.Shapes.AddTextbox(1, (Px $x), (Px $y), (Px $w), (Px $h))
  $s.TextFrame.MarginLeft = 0
  $s.TextFrame.MarginRight = 0
  $s.TextFrame.MarginTop = 0
  $s.TextFrame.MarginBottom = 0
  $s.TextFrame.WordWrap = -1
  $s.TextFrame.TextRange.Text = $text
  $s.TextFrame.TextRange.Font.Name = $font
  $s.TextFrame.TextRange.Font.NameFarEast = $font
  $s.TextFrame.TextRange.Font.Size = Px $fontSize
  $s.TextFrame.TextRange.Font.Color.RGB = RGB $color
  $s.TextFrame.TextRange.Font.Bold = if ($bold) { -1 } else { 0 }
  $s.Fill.Visible = 0
  $s.Line.Visible = 0
  return $s
}

function Add-WavyUnderline($slide, $x, $y, $w, $color, $weight = 4) {
  $segments = 18
  $step = $w / $segments
  for ($i = 0; $i -lt $segments; $i++) {
    $x1 = $x + ($i * $step)
    $x2 = $x + (($i + 1) * $step)
    $y1 = $y + ([Math]::Sin($i * 1.35) * 2)
    $y2 = $y + ([Math]::Sin(($i + 1) * 1.35) * 2)
    Add-Line $slide $x1 $y1 $x2 $y2 $color $weight 0.18 | Out-Null
  }
  Add-Line $slide $x ($y + 5) ($x + $w) ($y + 5) $color 2 0.62 | Out-Null
}

$powerPoint = New-Object -ComObject PowerPoint.Application
$powerPoint.Visible = -1

$presentation = $powerPoint.Presentations.Add()
$presentation.PageSetup.SlideWidth = Px 1280
$presentation.PageSetup.SlideHeight = Px 720

$slide = $presentation.Slides.Add(1, 12)
$slide.FollowMasterBackground = 0

Add-Rect $slide 0 0 1280 720 "#17120B" 0 | Out-Null

Add-Ellipse $slide 350 0 580 420 "#FFD278" 0.86 | Out-Null
Add-Ellipse $slide -70 455 560 360 "#FFFFFF" 0.94 | Out-Null
Add-Ellipse $slide 170 70 940 660 "#000000" 0.88 | Out-Null

for ($x = 0; $x -le 1280; $x += 42) {
  Add-Line $slide $x 0 $x 720 "#FFFFFF" 1 0.90 | Out-Null
}
for ($y = 0; $y -le 720; $y += 42) {
  Add-Line $slide 0 $y 1280 $y "#FFFFFF" 1 0.90 | Out-Null
}

Add-Rect $slide 0 0 1280 55 "#000000" 0.78 | Out-Null
Add-Rect $slide 0 665 1280 55 "#000000" 0.70 | Out-Null
Add-Rect $slide 0 0 70 720 "#000000" 0.72 | Out-Null
Add-Rect $slide 1210 0 70 720 "#000000" 0.72 | Out-Null

$paperX = 108.8
$paperY = 68.4
$paperW = 1062.4
$paperH = 576
$paper = Add-Rect $slide $paperX $paperY $paperW $paperH "#E7D7B5" 0 $null $false
$paper.Shadow.Visible = -1
$paper.Shadow.ForeColor.RGB = RGB "#000000"
$paper.Shadow.Transparency = 0.58
$paper.Shadow.OffsetX = Px 0
$paper.Shadow.OffsetY = Px 34

Add-Ellipse $slide ($paperX + 35) ($paperY + 25) 410 260 "#FFFFFF" 0.72 | Out-Null
Add-Ellipse $slide ($paperX + 600) ($paperY + 320) 430 300 "#5D3816" 0.90 | Out-Null
for ($i = 0; $i -lt 38; $i++) {
  $x1 = $paperX + ($i * 29) - 160
  Add-Line $slide $x1 ($paperY + 5) ($x1 + 255) ($paperY + $paperH - 5) "#482A10" 1 0.88 | Out-Null
}
for ($i = 1; $i -lt 33; $i++) {
  $x = $paperX + ($i * 31)
  Add-Line $slide $x ($paperY + 8) $x ($paperY + $paperH - 8) "#FFFFFF" 1 0.88 | Out-Null
}

Add-Text $slide '历史文件' 166.8 111.5 260 28 17 "#6D5C48" $true | Out-Null
Add-Text $slide '《朴茨茅斯和约》' 166.8 146.5 720 62 42 "#2C2115" $true | Out-Null
Add-Rect $slide 166.8 228 948 2 "#2C2115" 0.68 | Out-Null

Add-Text $slide '条约上用词谨慎，所谓“转让”遮住了更复杂的权力关系。' 166.8 261 850 60 28 "#2C2115" $false | Out-Null
Add-Text $slide '关东州租借地与南满铁路，成为战后日本经营大陆的新支点。' 166.8 309 900 60 28 "#2C2115" $false | Out-Null

Add-WavyUnderline $slide 390 304 480 "#782416" 5
Add-WavyUnderline $slide 167 352 82 "#782416" 4
Add-WavyUnderline $slide 363 352 112 "#782416" 4

$sealLine = @{ Color = "#821414"; Weight = 8; Transparency = 0.32 }
$seal = Add-Ellipse $slide 975.2 458.0 140 140 "#E7D7B5" 1 $sealLine
$seal.Rotation = -13
$sealText = Add-Text $slide "ARCHIVE" 980 516 135 30 19 "#821414" $true "Georgia"
$sealText.Rotation = -13
$sealText.TextFrame.TextRange.ParagraphFormat.Alignment = 2
$sealText.TextFrame.TextRange.Font.Color.RGB = RGB "#821414"

$presentation.SaveAs($pptxPath, 24)
$slide.Export($previewPath, "PNG", 1280, 720)
$presentation.Close()
$powerPoint.Quit()

[System.Runtime.InteropServices.Marshal]::ReleaseComObject($slide) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($presentation) | Out-Null
[System.Runtime.InteropServices.Marshal]::ReleaseComObject($powerPoint) | Out-Null

Write-Output $pptxPath
Write-Output $previewPath
