import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBolt, faClipboard, faDownload, faMusic, faSearch, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons'
import {
  Activity, Bot, Check, ChevronLeft, ChevronRight, Clipboard, Clock3, Copy,
  Download, Eye, FileAudio, FileVideo, FolderOpen, Gauge, History,
  Home, Info, Languages, ListChecks, LoaderCircle, Menu, MessageCircle, Moon,
  Music2, PauseCircle, Play, Plus, Search, Send, Settings, ShieldCheck, Sparkles,
  Sun, Trash2, UploadCloud, WandSparkles, X, Zap, Cable, KeyRound, Server, Wifi,
  BrainCircuit, Image as ImageIcon
  , Wrench, Captions, Scissors, ListVideo, RefreshCw, MonitorUp,
  RotateCcw, PackageOpen, Save, Film, Coffee, ExternalLink, Heart,
  Link2, Volume2, Video, Cpu, Layers
} from 'lucide-react'
import './styles.css'

const pages = [
  ['Home', Home], ['AI', Bot], ['Downloads', Download], ['Queue', ListChecks],
  ['History', History], ['Convert', RotateCcw], ['Studio', Wrench], ['Settings', Settings], ['About', Info]
]
const qualities = ['Best', '4K / 2160p', '1440p', '1080p', '720p', '480p', '360p']
const videoFormats = ['MP4', 'MKV', 'WebM', 'Auto']
const audioFormats = ['MP3', 'M4A', 'AAC', 'WAV', 'FLAC', 'OGG', 'Original']
const errorText = error => error?.message || String(error || 'Something went wrong.')
const I18nContext = createContext(value => value)
const khmer = {
  // Navigation & Core Pages
  Home: 'ទំព័រដើម', 'AI assistant': 'ជំនួយការ AI', AI: 'ជំនួយការ AI', Downloads: 'ការទាញយក', Queue: 'ជួររង់ចាំ', 'Download queue': 'ដំណើរការទាញយក', History: 'ប្រវត្តិ', 'History & activity': 'ប្រវត្តិ & សកម្មភាព', Convert: 'បម្លែង', 'Media converter': 'កម្មវិធីបម្លែងមេឌៀ', Studio: 'ស្ទូឌីយោ', 'Creator studio': 'ស្ទូឌីយោអ្នកបង្កើត', Settings: 'ការកំណត់', About: 'អំពីកម្មវិធី',
  'Fast • private • portable': 'លឿន • ឯកជន • ចល័ត', 'More than downloads.': 'លើសពីការទាញយកវីដេអូធម្មតា,', 'Create without limits.': 'ប្រើប្រាស់ដោយគ្មានដែនកំណត់',
  'Download, convert, and understand video with AI—all in one private creative workspace.': 'ទាញយក បម្លែង និងស្វែងយល់វីដេអូជាមួយ AI ក្នុងកន្លែងការងារឯកជនតែមួយ។',
  'Private local workflow': 'ដំណើរការឯកជនក្នុងម៉ាស៊ីន', 'Made by Chuob Piseth': 'បង្កើតដោយ Chuob Piseth', 'Starting CPS Universal Downloader…': 'កំពុងចាប់ផ្ដើម CPS Universal Downloader…',

  // Hero & Search
  'Paste a link to get started': 'បិទភ្ជាប់តំណដើម្បីចាប់ផ្តើមការទាញយក', 'Paste video URL, playlist, or multiple links here (YouTube, TikTok, Facebook…)': 'បិទភ្ជាប់តំណវីដេអូ បញ្ជីវីដេអូ ឬតំណច្រើននៅទីនេះ...',
  'One URL, a playlist, or multiple links.': 'តំណមួយ បញ្ជីចាក់ ឬតំណច្រើន។', Paste: 'បិទភ្ជាប់', Analyze: 'វិភាគ', 'Analyze only': 'វិភាគតែសុទ្ធ', Analyzing: 'កំពុងវិភាគ', 'Analyzing…': 'កំពុងវិភាគ…',
  'Analyzing link and loading available videos…': 'កំពុងវិភាគតំណ និងចាប់យកវីដេអូដែលមាន…', 'Clear link': 'សម្អាតតំណ', Ready: 'រួចរាល់', 'SharePoint + 1,000 sites': 'SharePoint + គេហទំព័រ ១០០០+',
  'Link pasted from clipboard': 'បានបិទភ្ជាប់តំណពី clipboard', 'Clipboard is empty. Copy a link first (Ctrl+C)': 'clipboard ទទេ សូមចម្លងតំណជាមុន (Ctrl+C)', 'Press Ctrl+V to paste the link': 'សូមចុច Ctrl+V ដើម្បីបិទភ្ជាប់តំណ',

  // Controls & Presets
  'Download settings': 'កំណត់ការទាញយក', Type: 'ប្រភេទ', Video: 'វីដេអូ', Audio: 'សំឡេង', Quality: 'គុណភាព', Format: 'ទម្រង់', 'Clip start': 'ចាប់ផ្ដើមកាត់', 'Clip end': 'បញ្ចប់កាត់', 'Full video': 'វីដេអូពេញ',
  'Quick presets': 'ការកំណត់រហ័ស', 'Download now': 'ទាញយកឥឡូវ', Download: 'ទាញយក', Working: 'កំពុងដំណើរការ', 'Working…': 'កំពុងដំណើរការ…', Best: 'ល្អបំផុត', Small: 'ទំហំតូច', 'Saving to': 'រក្សាទុកទៅ', Change: 'ប្ដូរថត', 'Change folder': 'ប្ដូរថត', 'Change destination folder': 'ប្ដូរថតគោលដៅ', 'Open folder': 'បើកថត', 'Open download folder': 'បើកថតទាញយក',
  'Analyze only previews media. Downloads start only after you select videos and click this button.': 'ការវិភាគគ្រាន់តែបង្ហាញទិដ្ឋភាពជាមុនប៉ុណ្ណោះ។ ការទាញយកនឹងចាប់ផ្ដើមលុះត្រាតែអ្នកជ្រើសរើសវីដេអូ ហើយចុចប៊ូតុងនេះ។',

  // Format Inspector
  'Format inspector': 'ពិនិត្យទម្រង់មេឌៀ', 'Choose an exact media stream below or keep automatic Best quality.': 'ជ្រើសរើសខ្សែទិន្នន័យជាក់លាក់ខាងក្រោម ឬរក្សាទុកគុណភាពល្អបំផុតដោយស្វ័យប្រវត្តិ។',
  '✓ Automatic Best (Active)': '✓ គុណភាពល្អបំផុតស្វ័យប្រវត្តិ (សកម្ម)', 'Reset to Automatic Best': 'កំណត់ទៅគុណភាពល្អបំផុតស្វ័យប្រវត្តិ',
  'All Streams': 'ទិន្នន័យទាំងអស់', 'Video + Audio': 'វីដេអូ + សំឡេង', 'Video Only': 'វីដេអូសុទ្ធអត់សម្លេង', 'Audio Only': 'សំឡេងសុទ្ធ', Select: 'ជ្រើសរើស', Selected: 'បានជ្រើស', Active: 'សកម្ម',
  'Direct stream format selected': 'បានជ្រើសរើសទម្រង់ខ្សែទិន្នន័យដោយផ្ទាល់', 'Download this format': 'ទាញយកទម្រង់នេះ', 'Direct download': 'ទាញយកផ្ទាល់',

  // Media Card & Actions
  'View Full': 'មើលរូបពេញ', 'View full-size': 'មើលរូបភាពពេញ', 'Save Thumbnail': 'រក្សាទុករូបតំណាង', 'Saving…': 'កំពុងរក្សាទុក…',
  'Download thumbnail image to your computer': 'ទាញយករូបភាពតំណាងទៅកាន់កុំព្យូទ័ររបស់អ្នក', 'Quick summary': 'សង្ខេបរហ័ស', 'Summarizing…': 'កំពុងសង្ខេប…',
  'Deep video analysis': 'ការវិភាគវីដេអូស៊ីជម្រៅ', 'Analyzing deeply…': 'កំពុងវិភាគស៊ីជម្រៅ…', 'Thumbnail review': 'ការពិនិត្យរូបតំណាង', 'Reviewing thumbnail…': 'កំពុងពិនិត្យរូបតំណាង…',
  'Thumbnail prompt': 'Prompt រូបតំណាង', 'Generating prompt…': 'កំពុងបង្កើត Prompt…', 'Copy result': 'ចម្លងលទ្ធផល', 'AI result copied': 'បានចម្លងលទ្ធផល AI',
  'Generated with your selected AI provider and model.': 'បានបង្កើតជាមួយអ្នកផ្ដល់ AI និងម៉ូដែលដែលអ្នកបានជ្រើសរើស។',

  // Playlist & Selection
  'Playlist videos': 'វីដេអូក្នុងបញ្ជីចាក់', 'Select all': 'ជ្រើសទាំងអស់', 'Deselect all': 'ដោះជម្រើសទាំងអស់', Clear: 'សម្អាត', selected: 'បានជ្រើសរើស', 'Download selected': 'ទាញយកដែលបានជ្រើស',
  'selected · click any video to select or deselect it': 'បានជ្រើសរើស · ចុចលើវីដេអូដើម្បីជ្រើស ឬដោះជម្រើស',

  // Downloads & Queue Pages & Tables
  'Follow current transfers or reopen completed files': 'តាមដានការផ្ទេរបច្ចុប្បន្ន ឬបើកឯកសារដែលបានបញ្ចប់', 'Current downloading': 'កំពុងទាញយកបច្ចុប្បន្ន', Downloaded: 'បានទាញយករួច', 'Downloaded files': 'ឯកសារដែលបានទាញយក',
  'Parallel, resumable transfers with live processing states': 'ទាញយកស្របគ្នា អាចបន្តឡើងវិញបាន ជាមួយស្ថានភាពផ្ទាល់', 'Clear stopped/errors': 'សម្អាតដែលបានបញ្ឈប់/កំហុស', 'Stop all': 'បញ្ឈប់ទាំងអស់',
  'Nothing downloading': 'មិនមានអ្វីកំពុងទាញយកទេ', 'Start a download from Home or the Queue.': 'ចាប់ផ្ដើមការទាញយកពីទំព័រដើម ឬពីជួររង់ចាំ។', 'No downloads yet': 'មិនទាន់មានការទាញយកនៅឡើយទេ', 'Completed files will appear here.': 'ឯកសារដែលបានបញ្ចប់នឹងបង្ហាញនៅទីនេះ។',
  'Select items, adjust priority, and recover failed transfers': 'ជ្រើសរើសធាតុ កែតម្រូវអាទិភាព និងស្ដារការផ្ទេរដែលបរាជ័យ', 'Recover all failed': 'ស្ដារដែលបរាជ័យទាំងអស់', 'Remove completed': 'លុបដែលបានបញ្ចប់', 'Queue is clear': 'ជួររង់ចាំគឺទទេស្អាត', 'Paste multiple links or add a playlist from Home.': 'បិទភ្ជាប់តំណច្រើន ឬបន្ថែមបញ្ជីចាក់ពីទំព័រដើម។', Low: 'ទាប', Normal: 'ធម្មតា', High: 'ខ្ពស់', Priority: 'អាទិភាព', Speed: 'ល្បឿន', ETA: 'ពេលវេលានៅសល់', Platform: 'ប្រភព', Time: 'ពេលវេលា', Level: 'កម្រិត', Event: 'ព្រឹត្តិការណ៍', Item: 'ធាតុ', Message: 'សារ', File: 'ឯកសារ', Completed: 'បានបញ្ចប់', 'completed items': 'ធាតុដែលបានបញ្ចប់',
  'Resume with the same settings': 'បន្តឡើងវិញដោយប្រើការកំណត់ដដែល', 'Retry with automatic best format': 'ព្យាយាមឡើងវិញដោយគុណភាពល្អបំផុត', 'Safe retry at 720p': 'ព្យាយាមឡើងវិញប្រកបដោយសុវត្ថិភាពនៅ 720p', 'Remove this download': 'លុបការទាញយកនេះ', 'Show downloaded file in folder': 'បង្ហាញឯកសារដែលបានទាញយកក្នុងថត', 'Show converted file in folder': 'បង្ហាញឯកសារដែលបានបម្លែងក្នុងថត',
  Failed: 'បរាជ័យ', Cancelled: 'បានបោះបង់', Paused: 'បានផ្អាក', Waiting: 'កំពុងរង់ចាំ', Downloading: 'កំពុងទាញយក', Processing: 'កំពុងដំណើរការ',

  // History Page
  'Completed files and a persistent diagnostic log': 'ឯកសារដែលបានបញ្ចប់ និងកំណត់ហេតុវិនិច្ឆ័យ', 'Download history': 'ប្រវត្តិទាញយក', 'Activity log': 'កំណត់ហេតុសកម្មភាព', 'Completed downloads': 'ការទាញយកដែលបានបញ្ចប់',
  'Saved across app restarts with the exact final file path.': 'រក្សាទុកទោះបីជាបិទបើកកម្មវិធី ជាមួយទីតាំងឯកសារច្បាស់លាស់។', 'Clear history': 'សម្អាតប្រវត្តិ', 'Clear log': 'សម្អាតកំណត់ហេតុ', 'No history yet': 'មិនទាន់មានប្រវត្តិនៅឡើយទេ',
  'Successfully completed downloads will appear here.': 'ការទាញយកដែលបានបញ្ចប់ដោយជោគជ័យនឹងបង្ហាញនៅទីនេះ។', 'No activity yet': 'មិនទាន់មានសកម្មភាពនៅឡើយទេ', 'New actions and diagnostics will be recorded here.': 'សកម្មភាពថ្មីៗ និងការវិភាគនឹងត្រូវបានកត់ត្រានៅទីនេះ។',
  'Analysis, queue, download, completion, cancellation, and error events.': 'ព្រឹត្តិការណ៍វិភាគ ជួររង់ចាំ ទាញយក បញ្ចប់ បោះបង់ និងកំហុស។',

  // Converter Page
  'Convert video, audio, and images locally with the bundled FFmpeg engine.': 'បម្លែងវីដេអូ សំឡេង និងរូបភាពក្នុងកុំព្យូទ័រដោយម៉ាស៊ីន FFmpeg។', 'Choose files': 'ជ្រើសរើសឯកសារ', 'Output format': 'ទម្រង់លទ្ធផល', 'Start conversion': 'ចាប់ផ្ដើមបម្លែង', 'No files selected': 'មិនទាន់ជ្រើសរើសឯកសារ', 'Choose one or more files from your computer.': 'ជ្រើសរើសឯកសារមួយ ឬច្រើនពីកុំព្យូទ័ររបស់អ្នក។', 'Save converted files to': 'រក្សាទុកឯកសារដែលបានបម្លែងទៅ', 'Existing files are never overwritten.': 'ឯកសារដែលមានស្រាប់នឹងមិនត្រូវបានសរសេរជាន់លើឡើយ។', 'Conversion jobs': 'ការងារបម្លែង', 'No conversion jobs': 'មិនមានការងារបម្លែងទេ', 'Choose local files and select an output format to begin.': 'ជ្រើសរើសឯកសារក្នុងម៉ាស៊ីន និងជ្រើសរើសទម្រង់លទ្ធផលដើម្បីចាប់ផ្ដើម។', Source: 'ប្រភព', Progress: 'វឌ្ឍនភាព', Status: 'ស្ថានភាព', Actions: 'សកម្មភាព', 'Output file': 'ឯកសារលទ្ធផល', files: 'ឯកសារ',
  'MOV, HEIC, MP4, MKV, audio, and image files are supported when their codec is available in FFmpeg.': 'គាំទ្រឯកសារ MOV, HEIC, MP4, MKV, សំឡេង និងរូបភាព នៅពេលកូដិកមានក្នុង FFmpeg។',

  // Studio Page
  'Creator studio': 'ស្ទូឌីយោអ្នកបង្កើត', 'Khmer Subtitle Studio': 'ស្ទូឌីយោចំណងជើងរងខ្មែរ', 'Load, edit, translate, export, or burn subtitles into a local video.': 'ផ្ទុក កែសម្រួល បកប្រែ នាំចេញ ឬដុតបញ្ចូលចំណងជើងរងទៅក្នុងវីដេអូ។', 'Load from video': 'ផ្ទុកពីវីដេអូ', 'Save SRT': 'រក្សាទុក SRT', 'Source track': 'ខ្សែសំឡេងប្រភព', 'Translate to': 'បកប្រែទៅជា', 'Keep original + translation': 'រក្សាទុកដើម + ការបកប្រែ (ពីរបន្ទាត់)', 'Translate subtitles': 'បកប្រែចំណងជើងរង', 'Burn subtitles into MP4': 'ដុតបញ្ចូលចំណងជើងរងទៅក្នុង MP4', 'Choose video': 'ជ្រើសរើសវីដេអូ', 'Complete Creator Pack': 'កញ្ចប់អ្នកបង្កើតមាតិកាពេញលេញ', 'Summary, chapters, titles, description, captions, hashtags, and a thumbnail prompt.': 'សង្ខេប, ជំពូក, ចំណងជើង, ការពិពណ៌នា, ចំណងជើងរង, hashtags និង prompt រូបតំណាង។', 'Generate complete package': 'បង្កើតកញ្ចប់ពេញលេញ', 'Detected chapters': 'ជំពូកដែលបានរកឃើញ', 'Export Markdown': 'នាំចេញជា Markdown', 'Save the current Home workflow': 'រក្សាទុកលំហូរការងារទំព័រដើមបច្ចុប្បន្ន', 'Save recipe': 'រក្សាទុករូបមន្ត', 'Apply on Home': 'អនុវត្តលើទំព័រដើម', Clips: 'វីដេអូខ្លី', Subtitles: 'ចំណងជើងរង', 'Creator Pack': 'កញ្ចប់អ្នកបង្កើត', Recipes: 'រូបមន្ត', 'AI Skills': 'ជំនាញ AI', 'Turn one video into clips, subtitles, creator assets, and reusable workflows': 'បម្លែងវីដេអូទៅជាឃ្លីបខ្លី ចំណងជើងរង ទ្រព្យអ្នកបង្កើត និងរូបមន្តប្រើឡើងវិញ',

  // Settings Page
  'Performance, browser connection, AI, and appearance': 'ប្រសិទ្ធភាព ការតភ្ជាប់កម្មវិធីរុករក AI និងរូបរាង', 'Download performance': 'ប្រសិទ្ធភាពទាញយក', 'Download folder': 'ថតទាញយក', 'Converted files folder': 'ថតឯកសារបម្លែង', 'Choose or paste download folder': 'ជ្រើសរើស ឬបិទភ្ជាប់ថតទាញយក', 'Choose or paste converted files folder': 'ជ្រើសរើស ឬបិទភ្ជាប់ថតឯកសារបម្លែង', 'Parallel downloads': 'ការទាញយកស្របគ្នា', 'Fragments per download': 'ផ្នែកក្នុងមួយការទាញយក', 'Download and converted files can use different folders. Choose both locations before saving settings.': 'ការទាញយក និងឯកសារបម្លែងអាចប្រើថតផ្សេងគ្នាបាន។ សូមជ្រើសរើសទីតាំងទាំងពីរមុនពេលរក្សាទុក។', 'Filename template': 'ទម្រង់ឈ្មោះឯកសារ', 'Prevent duplicate downloads': 'ការពារការទាញយកស្ទួន', 'Site authentication': 'ការផ្ទៀងផ្ទាត់គេហទំព័រ', 'Facebook, TikTok, Douyin, and authorized SharePoint links may need cookies from a browser where you are signed in. Close that browser first if its cookie database is locked. Owner-blocked downloads remain unavailable.': 'តំណ Facebook, TikTok, Douyin និង SharePoint ដែលមានការអនុញ្ញាត អាចត្រូវការខូគីពីកម្មវិធីរុករកដែលអ្នកបានចូលគណនីរួច។ សូមបិទកម្មវិធីរុករកនោះជាមុន ប្រសិនបើទិន្នន័យខូគីជាប់សោ។ ការទាញយកដែលម្ចាស់ហាមឃាត់មិនអាចទាញយកបានឡើយ។', 'Use browser cookies': 'ប្រើខូគីកម្មវិធីរុករក', Appearance: 'រូបរាង', System: 'តាមប្រព័ន្ធ', Light: 'ភ្លឺ', Dark: 'ងងឹត', 'Liquid Glass': 'កញ្ចក់ថ្លា', 'Application updates': 'ការអាប់ដេតកម្មវិធី', 'Automatically checks verified releases from GitHub and restarts after installation.': 'ពិនិត្យមើលកំណែថ្មីដែលបានបញ្ជាក់ពី GitHub ដោយស្វ័យប្រវត្តិ និងចាប់ផ្ដើមឡើងវិញក្រោយដំឡើង។', 'Check for updates': 'ពិនិត្យមើលការអាប់ដេត', 'Release update service': 'សេវាកម្មអាប់ដេតកំណែថ្មី', 'You have the latest version': 'អ្នកកំពុងប្រើប្រាស់កំណែចុងក្រោយបំផុតហើយ', 'Browser extension': 'ផ្នែកបន្ថែមកម្មវិធីរុករក', 'Authenticated local connection for the YouTube, TikTok, Facebook, and web video button.': 'ការតភ្ជាប់ក្នុងម៉ាស៊ីនប្រកបដោយសុវត្ថិភាពសម្រាប់ប៊ូតុងទាញយកលើ YouTube, TikTok, Facebook និងវិបសាយនានា។', 'Test connection': 'សាកល្បងការតភ្ជាប់', 'Export extension': 'នាំចេញផ្នែកបន្ថែម', 'Local endpoint': 'ចំណុចតភ្ជាប់ក្នុងម៉ាស៊ីន', 'Connection token': 'កូដតភ្ជាប់ Token', Connected: 'បានភ្ជាប់', 'Not tested': 'មិនទាន់សាកល្បង', 'AI provider and model': 'អ្នកផ្តល់ AI និងម៉ូដែល', 'Choose your preferred AI intelligence engine. Supports Google Gemini, Groq Cloud, OpenRouter, CodeCraft, and Inception Labs.': 'ជ្រើសរើសម៉ាស៊ីនបញ្ញាសិប្បនិម្មិត AI ដែលអ្នកពេញចិត្ត។ គាំទ្រ Google Gemini, Groq Cloud, OpenRouter, CodeCraft និង Inception Labs។', 'Download enhancements': 'មុខងារបន្ថែមការទាញយក', 'Apply subtitles, SponsorBlock segments, or chapter splitting to new jobs.': 'អនុវត្តចំណងជើងរង ការកាត់ផ្នែកផ្សាយពាណិជ្ជកម្ម SponsorBlock ឬពុះចែកជំពូក។', 'Subtitle language': 'ភាសាចំណងជើងរង', 'Embed subtitles': 'បង្កប់ចំណងជើងរងក្នុងវីដេអូ', 'Remove SponsorBlock segments': 'ដកចេញផ្នែកផ្សាយពាណិជ្ជកម្ម SponsorBlock', 'Split files by chapters': 'ពុះចែកឯកសារតាមជំពូក', 'Authentication test': 'សាកល្បងការផ្ទៀងផ្ទាត់', 'Verify that the selected browser session can access Facebook, TikTok, Douyin, SharePoint, or another signed-in video.': 'ផ្ទៀងផ្ទាត់ថាសម័យកម្មវិធីរុករកដែលបានជ្រើស អាចចូលមើលវីដេអូ Facebook, TikTok, Douyin, SharePoint ឬវីដេអូដែលត្រូវការ Login ផ្សេងទៀត។', 'Test access': 'សាកល្បងចូលមើល', 'Save settings': 'រក្សាទុកការកំណត់', 'Checking…': 'កំពុងពិនិត្យ…', 'Connecting…': 'កំពុងតភ្ជាប់…', 'Check local model': 'ពិនិត្យម៉ូដែលក្នុងម៉ាស៊ីន', 'Test & load models': 'សាកល្បង & ផ្ទុកម៉ូដែល', 'Automatically try another configured provider when the default fails': 'ព្យាយាមប្រើអ្នកផ្ដល់សេវាផ្សេងទៀតដោយស្វ័យប្រវត្តិ នៅពេលលំនាំដើមបរាជ័យ', 'Add Gemini API key': 'បន្ថែមសោ API Gemini', 'Add key': 'បន្ថែមសោ', 'Remove key': 'លុបសោ', 'Gemini model': 'ម៉ូដែល Gemini', 'Paste a signed-in video URL': 'បិទភ្ជាប់តំណវីដេអូដែលបានចូលគណនី', 'API base URL': 'URL មូលដ្ឋាន API', 'API key (optional for local APIs)': 'សោ API (ជាជម្រើសសម្រាប់ API ក្នុងម៉ាស៊ីន)', Model: 'ម៉ូដែល', 'Load available models': 'ផ្ទុកម៉ូដែលដែលមាន',

  // AI Page
  'Realtime conversation with optional transcript-grounded answers': 'ការសន្ទនាផ្ទាល់ជាមួយចម្លើយផ្អែកលើអត្ថបទវីដេអូ', 'Video context': 'បរិបទវីដេអូ', 'Attach a public video URL': 'ភ្ជាប់តំណវីដេអូសាធារណៈ', 'Use current': 'ប្រើវីដេអូបច្ចុប្បន្ន', 'Ground answers in the video transcript and cite timestamps': 'ផ្អែកលើអត្ថបទវីដេអូ និងបញ្ជាក់ពេលវេលា', 'Ask about the video, request a script, title ideas, or thumbnail prompt…': 'សួរអំពីវីដេអូ ស្នើសុំស្គ្រីប គំនិតចំណងជើង ឬរូបភាពតំណាង…', 'Creative workflows': 'លំហូរការងារច្នៃប្រឌិត', 'Video summary': 'សង្ខេបវីដេអូ', 'Deep analysis': 'ការវិភាគស៊ីជម្រៅ', 'Script writer': 'អ្នកសរសេរស្គ្រីប',

  // About Page
  'Free, open source, and privacy-focused media workspace': 'កន្លែងការងារមេឌៀឥតគិតថ្លៃ ប្រភពបើកចំហ និងផ្តោតលើភាពឯកជន',
  '100% Free & Open Source • MIT License': '100% ឥតគិតថ្លៃ & កូដចំហ (Open Source) • អាជ្ញាប័ណ្ណ MIT',
  Version: 'កំណែ', 'Active Engine': 'Engine កំពុងដំណើរការ',
  'A lightning-fast, privacy-first desktop workspace to download media from YouTube, TikTok, Facebook, Douyin, SharePoint, and 1,000+ platforms. Features native FFmpeg media conversion, multi-provider AI assistance (Groq Cloud, OpenRouter, CodeCraft, Inception Labs, Google Gemini), and zero tracking.': 'កម្មវិធីកុំព្យូទ័រល្បឿនលឿន និងសុវត្ថិភាពខ្ពស់ សម្រាប់ទាញយកវីដេអូពី YouTube, TikTok, Facebook, Douyin, SharePoint និងគេហទំព័រជាង ១០០០+ ផ្សេងទៀត។ មានភ្ជាប់មកជាមួយនូវម៉ាស៊ីនបម្លែង FFmpeg, ជំនួយការ AI ច្រើនប្រភព (Groq Cloud, OpenRouter, CodeCraft, Inception Labs, Google Gemini) និងគ្មានការតាមដានទិន្នន័យឡើយ។',
  'Turbo Concurrent Engine': 'ប្រព័ន្ធទាញយកល្បឿនលឿន Turbo',
  'Resumable multi-threaded fragments, 64K buffer, and intelligent quality fallback.': 'ទាញយកល្បឿនលឿនជាច្រើនផ្នែក អាចបន្តទាញយកឡើងវិញ ជាមួយ buffer 64K និងជម្រើសគុណភាពស្វ័យប្រវត្តិ។',
  'Native Media Converter': 'មុខងារបម្លែងវីដេអូក្នុងម៉ាស៊ីន (Converter)',
  'Lossless FFmpeg conversion for MP4, MKV, MP3, WAV, FLAC, HEIC, and GIFs.': 'បម្លែងឯកសារដោយរក្សាគុណភាពដើមជាមួយ FFmpeg សម្រាប់ MP4, MKV, MP3, WAV, FLAC, HEIC និង GIF។',
  'Multi-Provider AI Intelligence': 'ជំនួយការ AI ចម្រុះប្រភព',
  'Groq (7K free/d), OpenRouter (Free Vision), Inception Labs (Mercury dLLM), CodeCraft (1M/mo), and Google Gemini.': 'Groq (៧០០០ សំណើឥតគិតថ្លៃ/ថ្ងៃ), OpenRouter (Vision ឥតគិតថ្លៃ), Inception Labs (Mercury dLLM), CodeCraft (១លាន token/ខែ) និង Google Gemini។',
  'Private & Secure': 'ឯកជនភាព និងសុវត្ថិភាព',
  'Zero telemetry. All keys encrypted with Windows DPAPI. Runs completely offline.': 'គ្មានការលួចប្រមូលទិន្នន័យ។ API keys ទាំងអស់ត្រូវបានការពារដោយ Windows DPAPI។ ដំណើរការដោយសុវត្ថិភាពខ្ពស់។',
  'GitHub Open Source Project': 'គម្រោងកូដចំហលើ GitHub',
  'This project is open-source under the MIT license. You can inspect the complete source code, download portable builds, submit feature suggestions, or contribute improvements.': 'គម្រោងនេះជាកម្មវិធីកូដចំហក្រោមអាជ្ញាប័ណ្ណ MIT។ អ្នកអាចពិនិត្យមើលកូដប្រភពទាំងស្រុង ទាញយកកំណែចល័ត ផ្ដល់យោបល់ ឬចូលរួមអភិវឌ្ឍន៍បន្ថែម។',
  'View Repository': 'មើលកូដប្រភព Repository', 'Releases & Notes': 'កំណែចេញផ្សាយ & កំណត់ចំណាំ', Releases: 'កំណែចេញផ្សាយ',
  'Support Our Work • Buy Me a Coffee': 'គាំទ្រការអភិវឌ្ឍន៍ • ឧបត្ថម្ភកាហ្វេ', '100% Free Software • Community Supported': 'សូហ្វវែរឥតគិតថ្លៃ ១០០% • គាំទ្រដោយសហគមន៍',
  'CPS Universal Downloader is free for everyone. If it saves you time and effort, you can support our ongoing development and buy me a coffee via ABA KHQR:': 'CPS Universal Downloader គឺឥតគិតថ្លៃសម្រាប់មនុស្សគ្រប់គ្នា។ ប្រសិនបើកម្មវិធីនេះជួយសម្រួលការងារ និងពេលវេលារបស់អ្នក អ្នកអាចគាំទ្រការអភិវឌ្ឍន៍បន្តរបស់យើងដោយការឧបត្ថម្ភកាហ្វេតាមរយៈ ABA KHQR៖',
  'Scan with ABA Mobile, Bakong, or any bank app': 'ស្កេនជាមួយ ABA Mobile, បាគង (Bakong) ឬកម្មវិធីធនាគារណាមួយ',
  'Download and convert only content that you own or have permission to use.': 'សូមទាញយក និងបម្លែងតែមាតិកាដែលជាកម្មសិទ្ធិរបស់អ្នក ឬទទួលបានការអនុញ្ញាតប៉ុណ្ណោះ។',

  // Common Verbs & UI Tokens
  Copy: 'ចម្លង', Send: 'ផ្ញើ', Browse: 'ស្វែងរក', Cancel: 'បោះបង់', Remove: 'លុប', Close: 'បិទ', Resume: 'បន្តឡើងវិញ', Retry: 'ព្យាយាមឡើងវិញ',
  'Copy Link': 'ចម្លងតំណ', 'Download Thumbnail': 'ទាញយករូបតំណាង', 'Thumbnail link copied': 'បានចម្លងតំណរូបភាពតំណាង',
  'Update Now': 'អាប់ដេតឥឡូវនេះ', Available: 'មានកំណែថ្មី', 'New Version Available:': 'មានកំណែថ្មី៖',
  'is ready to install!': 'រួចរាល់សម្រាប់ការដំឡើង!'
}

function PlatformLogo({ name, label }) {
  return <span className="platform-logo"><img src={`./platforms/${name}.svg`} alt=""/><span>{label}</span></span>
}

function GitHubIcon({ size = 20, className = "" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} role="img" aria-label="GitHub">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  )
}

function waitForApi() {
  const preview = new URLSearchParams(location.search)
  if (preview.has('preview')) {
    const settings = { theme: preview.get('theme') || 'Light', language: preview.get('language') || 'English', saveLocation: 'C:\\Users\\User\\Downloads', conversionLocation: 'C:\\Users\\User\\Videos\\CPS Converted', parallelDownloads: 2, concurrentFragments: 4, browserCookies: 'None', preventDuplicates: true, filenameTemplate: '%(title)s [%(id)s].%(ext)s', apiToken: 'local-preview-token', aiProvider: 'Gemini', geminiModel: 'gemini-2.5-flash', codecraftModel: 'claude-opus-4.8', customApiBase: 'https://api.openai.com/v1', customApiModel: '', subtitleLanguage: 'en', embedSubtitles: false, sponsorBlock: false, splitChapters: false, updateChannel: 'Stable', hasGeminiKey: false, hasCodecraftApiKey: false, hasCustomApiKey: false }
    return Promise.resolve({ bootstrap: async () => ({ version: '1.2.6-preview', settings, queue: [], history: [], activity: [], recipes: [], conversions: [], updateStatus: { status: 'current', currentVersion: '1.2.6-preview', available: false, message: 'Preview build' }, toolsReady: true, extensionReady: true }), get_state: async () => ({ queue: [], history: [], activity: [], recipes: [], conversions: [], updateStatus: { status: 'current', currentVersion: '1.2.6-preview', available: false, message: 'Preview build' }, running: false }), list_gemini_keys_masked: async () => [] })
  }
  if (window.pywebview?.api) return Promise.resolve(window.pywebview.api)
  return new Promise(resolve => window.addEventListener('pywebviewready', () => resolve(window.pywebview.api), { once: true }))
}

const compactNumber = value => value ? new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value) : '—'
const duration = seconds => {
  if (!seconds) return '—'
  const total = Math.round(seconds), hours = Math.floor(total / 3600), minutes = Math.floor(total % 3600 / 60), secs = total % 60
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}` : `${minutes}:${String(secs).padStart(2, '0')}`
}

let florenceRuntime = null
async function florenceThumbnailPrompt(imageUrl, title, onProgress = () => {}, mode = 'prompt') {
  const { Florence2ForConditionalGeneration, AutoProcessor, load_image, env } = await import('@huggingface/transformers')
  env.allowLocalModels = false
  env.useBrowserCache = true
  if (!florenceRuntime) {
    const modelId = 'onnx-community/Florence-2-base'
    const progress_callback = event => {
      if (event?.status === 'progress') onProgress(`Downloading Local AI… ${Math.round(event.progress || 0)}%`)
      else if (event?.status) onProgress(`Local AI: ${event.status}`)
    }
    onProgress('Loading Local AI model…')
    const options = { dtype: 'q4', device: navigator.gpu ? 'webgpu' : 'wasm', progress_callback }
    const [model, processor] = await Promise.all([
      Florence2ForConditionalGeneration.from_pretrained(modelId, options),
      AutoProcessor.from_pretrained(modelId, { progress_callback })
    ])
    florenceRuntime = { model, processor }
  }
  onProgress('Local AI is analyzing the thumbnail…')
  const image = await load_image(imageUrl)
  const task = '<MORE_DETAILED_CAPTION>'
  const prompts = florenceRuntime.processor.construct_prompts(task)
  const inputs = await florenceRuntime.processor(image, prompts)
  const generated = await florenceRuntime.model.generate({ ...inputs, max_new_tokens: 120 })
  const decoded = florenceRuntime.processor.batch_decode(generated, { skip_special_tokens: false })[0]
  const result = florenceRuntime.processor.post_process_generation(decoded, task, image.size)
  const caption = result[task] || String(result)
  const productionPrompt = `Create a high-impact 16:9 video thumbnail inspired by this visual analysis: ${caption}. ${title ? `Video context: ${title}. ` : ''}Use a clear primary subject, expressive pose, strong foreground-background separation, cinematic lighting, vibrant complementary colors, crisp commercial detail, and intentional negative space for a short headline. Preserve the composition and mood without copying logos or existing text. No watermark, no distorted face, no extra fingers, no unreadable typography.`
  if (mode === 'review') return `LOCAL VISUAL ANALYSIS\n${caption}\n\nWHAT WORKS\nThe image has a recognizable subject and visual story that can be strengthened for small-screen viewing.\n\nIMPROVEMENT CHECKLIST\n1. Make one subject the unmistakable focal point.\n2. Increase foreground/background separation and edge contrast.\n3. Simplify small details that disappear at thumbnail size.\n4. Reserve clean negative space for a short, readable headline.\n5. Use one dominant color pair and a clear emotional expression.\n\nIMPROVED IMAGE-GENERATION PROMPT\n${productionPrompt}`
  return productionPrompt
}

function IconButton({ children, className = '', ...props }) {
  return <button className={`icon-button ${className}`} {...props}>{children}</button>
}

function Button({ icon: Icon, children, variant = 'soft', className = '', ...props }) {
  const t = useContext(I18nContext)
  return <button className={`button ${variant} ${className}`} {...props}>{Icon && <Icon size={18} strokeWidth={2.2}/>}<span>{typeof children === 'string' ? t(children) : children}</span></button>
}

function Card({ children, className = '' }) { return <section className={`card ${className}`}>{children}</section> }

function PageHeader({ title, subtitle, action }) {
  const t = useContext(I18nContext)
  return <div className="page-header"><div><h1>{t(title)}</h1><p>{t(subtitle)}</p></div>{action}</div>
}

function Progress({ value = 0 }) {
  return <div className="progress-track"><div className="progress-fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }}/><span>{Math.round(value)}%</span></div>
}

function Empty({ icon: Icon = Download, title, text }) {
  const t = useContext(I18nContext)
  return <div className="empty"><div className="empty-icon"><Icon size={27}/></div><h3>{t(title)}</h3><p>{t(text)}</p></div>
}

function App() {
  const [api, setApi] = useState(null)
  const [boot, setBoot] = useState(null)
  const [page, setPage] = useState(() => new URLSearchParams(location.search).get('page') || 'Home')
  const [collapsed, setCollapsed] = useState(false)
  const [theme, setTheme] = useState('System')
  const [url, setUrl] = useState('')
  const [media, setMedia] = useState(() => new URLSearchParams(location.search).has('media') ? { url: 'https://www.youtube.com/watch?v=preview', title: 'Amazing Cambodia — Angkor Wat in 4K', creator: 'CPS Travel', platform: 'YouTube', thumbnail: './platforms/youtube.svg', duration: 754, views: 1234567, description: 'A cinematic journey through Cambodia, its temples, landscapes, culture, and people.', entries: [] } : null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('Ready')
  const [toast, setToast] = useState('')
  const [queue, setQueue] = useState([])
  const [history, setHistory] = useState([])
  const [activity, setActivity] = useState([])
  const [recipes, setRecipes] = useState([])
  const [running, setRunning] = useState(false)
  const [kind, setKind] = useState('Video')
  const [quality, setQuality] = useState('Best')
  const [format, setFormat] = useState('MP4')
  const [formatId, setFormatId] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [downloadTab, setDownloadTab] = useState('Current')
  const [playlistSelection, setPlaylistSelection] = useState([])
  const [settingsDraft, setSettingsDraft] = useState(null)
  const [aiInput, setAiInput] = useState('')
  const [aiVideo, setAiVideo] = useState('')
  const [aiGrounded, setAiGrounded] = useState(false)
  const [messages, setMessages] = useState([{ role: 'CPS AI', text: 'Attach a video link or ask me for video ideas, scripts, titles, summaries, and thumbnail concepts.' }])
  const [models, setModels] = useState([])
  const [aiConnection, setAiConnection] = useState(null)
  const [extensionConnection, setExtensionConnection] = useState(null)
  const [homeAiBusy, setHomeAiBusy] = useState('')
  const [homeAiResult, setHomeAiResult] = useState(null)
  const [studioResult, setStudioResult] = useState('')
  const [studioBusy, setStudioBusy] = useState('')
  const [localVideo, setLocalVideo] = useState('')
  const [geminiKeys, setGeminiKeys] = useState([])
  const [localAiStatus, setLocalAiStatus] = useState('Local model downloads on first use and then works offline.')
  const [updateStatus, setUpdateStatus] = useState({ status: 'idle', currentVersion: '', latestVersion: '', available: false, progress: 0, message: 'Updates are checked automatically.' })
  const [convertFiles, setConvertFiles] = useState([])
  const [convertFormat, setConvertFormat] = useState('MP4')
  const [conversions, setConversions] = useState([])
  const [viewingThumbnail, setViewingThumbnail] = useState(null)
  const [downloadingThumb, setDownloadingThumb] = useState(false)
  const mediaSectionRef = useRef(null)
  const t = value => settingsDraft?.language === 'Khmer' ? (khmer[value] || value) : value

  useEffect(() => {
    if (media && mediaSectionRef.current) {
      setTimeout(() => {
        mediaSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
    }
  }, [media])

  useEffect(() => {
    waitForApi().then(async desktop => {
      setApi(desktop)
      const value = await desktop.bootstrap()
      setBoot(value); setQueue(value.queue); setHistory(value.history); setActivity(value.activity || []); setRecipes(value.recipes || []); setConversions(value.conversions || []); setUpdateStatus(value.updateStatus || updateStatus); setTheme(value.settings.theme); setSettingsDraft(value.settings)
      setGeminiKeys(await desktop.list_gemini_keys_masked())
    }).catch(error => setStatus(errorText(error)))
  }, [])

  useEffect(() => {
    if (!api) return
    const timer = setInterval(async () => {
      try {
        const state = await api.get_state()
        setQueue(state.queue); setHistory(state.history); setActivity(state.activity || []); setRecipes(state.recipes || []); setConversions(state.conversions || []); setUpdateStatus(state.updateStatus || updateStatus); setRunning(state.running)
      } catch { /* Window may be closing. */ }
    }, 500)
    return () => clearInterval(timer)
  }, [api])

  useEffect(() => {
    const mediaQuery = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      let actual
      if (theme === 'System') {
        actual = mediaQuery.matches ? 'dark' : 'light'
      } else if (theme === 'Liquid Glass' || theme === 'liquid-glass') {
        actual = 'liquid-glass'
      } else {
        actual = theme.toLowerCase()
      }
      document.documentElement.dataset.theme = actual
      document.documentElement.style.colorScheme = actual === 'light' ? 'light' : 'dark'
    }
    apply()
    mediaQuery.addEventListener?.('change', apply)
    return () => mediaQuery.removeEventListener?.('change', apply)
  }, [theme])

  useEffect(() => {
    document.documentElement.lang = settingsDraft?.language === 'Khmer' ? 'km' : 'en'
  }, [settingsDraft?.language])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(''), 2600)
    return () => clearTimeout(timer)
  }, [toast])

  const options = (fid = formatId) => ({ kind, quality, format, formatId: fid, startTime, endTime, saveLocation: settingsDraft?.saveLocation, subtitleLanguage: settingsDraft?.subtitleLanguage, embedSubtitles: settingsDraft?.embedSubtitles, sponsorBlock: settingsDraft?.sponsorBlock, splitChapters: settingsDraft?.splitChapters })
  const waitingIds = queue.filter(item => item.selected && item.status === 'Waiting').map(item => item.id)
  const active = queue.filter(item => !['Completed'].includes(item.status))

  async function catchPreviewAndAnalyze(target) {
    const raw = typeof target === 'string' ? target : url
    const urls = (raw || '').split(/\s+/).filter(value => /^https?:\/\//i.test(value))
    if (!urls.length) return setStatus(t('Paste a link to get started'))
    setHomeAiResult(null)
    const targetUrl = urls[0]

    if (urls.length > 1) {
      const youtubeId = value => value.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/i)?.[1] || ''
      const entries = urls.map((value, index) => {
        const id = youtubeId(value)
        return {
          url: value,
          title: id ? `YouTube video ${index + 1}` : value,
          platform: id ? 'YouTube' : new URL(value).hostname,
          thumbnail: id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : '',
          duration: null
        }
      })
      setMedia({
        url: targetUrl,
        title: `${entries.length} pasted video links`,
        creator: '',
        platform: 'Multiple links',
        thumbnail: entries[0]?.thumbnail || '',
        duration: null,
        views: null,
        description: 'Review the list and choose only the videos you want. Analyze does not add anything to the queue or start a download.',
        entries,
        formats: [],
        subtitles: [],
        chapters: []
      })
      setAiVideo(targetUrl)
      setFormatId('')
      setPlaylistSelection([])
      setStatus(`${entries.length} links analyzed — nothing downloaded. Select videos manually.`)
      return
    }

    // Step 1: INSTANT CATCH PREVIEW (< 50ms)
    const ytMatch = targetUrl.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/i)
    if (ytMatch) {
      const ytId = ytMatch[1]
      setMedia({
        url: targetUrl,
        title: `YouTube Video (${ytId})`,
        creator: '',
        platform: 'YouTube',
        thumbnail: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
        duration: null,
        views: null,
        description: 'Inspecting media streams & available formats…',
        entries: [],
        formats: [],
        subtitles: [],
        chapters: [],
        isProvisional: true,
      })
      setAiVideo(targetUrl)
      setFormatId('')
      setPlaylistSelection([])
      // Instant title from YouTube public oEmbed
      fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`)
        .then(res => res.json())
        .then(data => {
          if (data?.title) {
            setMedia(curr => (curr && curr.url === targetUrl && curr.isProvisional)
              ? { ...curr, title: data.title, creator: data.author_name || curr.creator }
              : curr
            )
          }
        })
        .catch(() => {})
    } else {
      let hostname = ''
      try { hostname = new URL(targetUrl).hostname.replace('www.', '') } catch {}
      setMedia({
        url: targetUrl,
        title: `${hostname || 'Web'} Video`,
        creator: '',
        platform: hostname || 'Web Video',
        thumbnail: '',
        duration: null,
        views: null,
        description: 'Inspecting media streams & available formats…',
        entries: [],
        formats: [],
        subtitles: [],
        chapters: [],
        isProvisional: true,
      })
      setAiVideo(targetUrl)
      setFormatId('')
      setPlaylistSelection([])
    }

    // Step 2: Full deep yt-dlp inspection
    try {
      setBusy(true)
      setStatus(t('Analyzing link and loading available videos…'))
      const result = await api.analyze(targetUrl)
      setMedia(result)
      setAiVideo(result.url)
      setFormatId('')
      setPlaylistSelection([])
      setStatus(result.entries.length ? `${result.entries.length} videos found — nothing downloaded. Select videos manually.` : `Ready from ${result.platform} — nothing downloaded`)
    } catch (error) {
      setStatus(errorText(error))
    } finally {
      setBusy(false)
    }
  }

  async function analyze() {
    await catchPreviewAndAnalyze(url)
  }

  async function downloadNow(targetFormatId) {
    const activeFormatId = typeof targetFormatId === 'string' ? targetFormatId : formatId
    if (media?.entries?.length && playlistSelection.length === 0) return setStatus('Select at least one video first. Analyze never starts a download.')
    try {
      setBusy(true)
      const sources = media?.entries?.length
        ? media.entries.filter((_, index) => playlistSelection.includes(index))
        : [{ url: media?.url || url, title: media?.title, platform: media?.platform }]
      const added = await api.add_urls(sources, options(activeFormatId))
      const result = await api.start_downloads(added.ids)
      if (!result.started) throw new Error(result.message)
      setPage('Downloads'); setDownloadTab('Current'); setToast(`${result.count} download${result.count === 1 ? '' : 's'} started`)
    } catch (error) { setStatus(errorText(error)) } finally { setBusy(false) }
  }

  async function paste() {
    try {
      let text = ''
      if (api?.read_clipboard_text) {
        text = await api.read_clipboard_text()
      }
      if (!text && navigator?.clipboard?.readText) {
        try { text = await navigator.clipboard.readText() } catch { /* Ignore */ }
      }
      text = (text || '').trim()
      if (text) {
        setUrl(text)
        setToast(t('Link pasted from clipboard'))
        if (/^https?:\/\//i.test(text)) {
          catchPreviewAndAnalyze(text)
        }
      } else {
        setToast(t('Clipboard is empty. Copy a link first (Ctrl+C)'))
      }
    } catch {
      setToast(t('Press Ctrl+V to paste the link'))
    }
  }

  async function saveThumbnailNow(thumbUrl = media?.thumbnail, title = media?.title) {
    if (!thumbUrl) return
    try {
      setDownloadingThumb(true)
      const result = await api.download_thumbnail(thumbUrl, title)
      setToast(result.message || 'Thumbnail saved to Downloads')
    } catch (error) { setToast(errorText(error)) }
    finally { setDownloadingThumb(false) }
  }

  async function startSelected() {
    const result = await api.start_downloads(waitingIds)
    if (result.started) { setPage('Downloads'); setToast(`${result.count} downloads started`) } else setToast(result.message)
  }

  async function updateItem(id, changes) { await api.update_queue_item(id, changes) }

  async function saveSettings() {
    try {
      const saved = await api.save_settings(settingsDraft); setSettingsDraft(saved); setTheme(saved.theme); setToast('Settings saved')
    } catch (error) { setToast(errorText(error)) }
  }

  async function browse() {
    const path = await api.choose_folder(settingsDraft.saveLocation)
    if (path) {
      setSettingsDraft(current => ({ ...current, saveLocation: path }))
      await api.save_settings({ saveLocation: path })
      setToast('Download folder updated')
    }
  }

  async function browseConversion() {
    const path = await api.choose_folder(settingsDraft.conversionLocation)
    if (path) {
      setSettingsDraft(current => ({ ...current, conversionLocation: path }))
      await api.save_settings({ conversionLocation: path })
      setToast('Converted files folder updated')
    }
  }

  async function loadModels() {
    try {
      setBusy(true); setAiConnection({ checking: true })
      const result = await api.test_ai_connection(settingsDraft)
      setModels(result.models); setAiConnection(result)
      const modelKey = result.provider === 'Custom' ? 'customApiModel' : result.provider === 'Gemini' ? 'geminiModel' : result.provider === 'CodeCraft' ? 'codecraftModel' : ''
      if (modelKey && result.models.length && !result.models.includes(settingsDraft[modelKey])) setSettingsDraft(current => ({ ...current, [modelKey]: result.models[0] }))
      setToast(result.message)
    } catch (error) { setAiConnection({ connected: false, message: errorText(error) }); setToast(errorText(error)) } finally { setBusy(false) }
  }

  async function testExtension() {
    try { const result = await api.browser_extension_status(); setExtensionConnection(result); setToast(result.connected ? 'Browser extension API is connected' : result.error || 'Extension API is unavailable') }
    catch (error) { setExtensionConnection({ connected: false, error: errorText(error) }); setToast(errorText(error)) }
  }

  async function checkAppUpdate() {
    try { setUpdateStatus(current => ({ ...current, status: 'checking', message: 'Checking GitHub for a new release…' })); setUpdateStatus(await api.check_app_update(true)) }
    catch (error) { setToast(errorText(error)) }
  }

  async function installAppUpdate() {
    try { setUpdateStatus(await api.install_app_update()); setToast('Downloading the verified update') }
    catch (error) { setToast(errorText(error)) }
  }

  async function setPreference(key, value) {
    const next = { ...settingsDraft, [key]: value }
    setSettingsDraft(next)
    if (key === 'theme') setTheme(value)
    try { const saved = await api.save_settings(next); setSettingsDraft(saved) } catch (error) { setToast(errorText(error)) }
  }

  async function sendAi() {
    const text = aiInput.trim(); if (!text) return
    const next = [...messages, { role: 'You', text }]; setMessages([...next, { role: 'CPS AI', text: 'Thinking…' }]); setAiInput('')
    try { const answer = aiGrounded && aiVideo ? await api.transcript_chat(text, aiVideo, next, settingsDraft.subtitleLanguage || 'en') : await api.ai_chat(text, aiVideo, next); setMessages([...next, { role: 'CPS AI', text: answer }]) }
    catch (error) { setMessages([...next, { role: 'CPS AI', text: `I couldn't complete that request: ${errorText(error)}` }]) }
  }

  async function executeEmbeddedSkill(skill) {
    if (!media?.url) throw new Error('Analyze a video on Home first.')
    if (skill === 'summary') return await api.summarize_video(media.url, media.title, settingsDraft.subtitleLanguage || 'en')
    if (skill === 'deep') return await api.analyze_video_meaning(media.url, media.title)
    if (!media.thumbnail) throw new Error('This video does not provide a thumbnail to analyze.')

    const preferred = settingsDraft.aiProvider || 'Gemini'
    const fallbackOrder = preferred === 'Florence-2' ? ['CodeCraft', 'Gemini', 'Custom'] : preferred === 'Gemini' ? ['CodeCraft', 'Custom', 'Florence-2'] : preferred === 'CodeCraft' ? ['Gemini', 'Custom', 'Florence-2'] : ['CodeCraft', 'Gemini', 'Florence-2']
    const providers = settingsDraft.aiFallback === false ? [preferred] : [...new Set([preferred, ...fallbackOrder])]
    const errors = []
    for (const provider of providers) {
      try {
        let text
        if (provider === 'Florence-2') {
          const image = await api.thumbnail_data_url(media.thumbnail)
          text = await florenceThumbnailPrompt(image, media.title, setLocalAiStatus, skill === 'thumbnail-review' ? 'review' : 'prompt')
        } else if (skill === 'thumbnail-review') {
          text = await api.analyze_thumbnail(media.thumbnail, media.title, provider)
        } else {
          text = await api.generate_thumbnail_prompt(media.thumbnail, media.title, provider)
        }
        setToast(`Generated with ${provider}`)
        return text
      } catch (error) { errors.push(`${provider}: ${errorText(error)}`) }
    }
    throw new Error(errors.join(' | '))
  }

  async function runHomeAiSkill(skill) {
    const titles = { summary: 'Quick video summary', deep: 'Deep video analysis', 'thumbnail-review': 'Thumbnail review', 'thumbnail-prompt': 'Thumbnail image prompt' }
    try {
      setHomeAiBusy(skill); setHomeAiResult(null)
      setHomeAiResult({ title: titles[skill], text: await executeEmbeddedSkill(skill) })
    } catch (error) { setToast(errorText(error)) } finally { setHomeAiBusy('') }
  }

  async function runStudio(kindName) {
    if (!media?.url && !['local-summary', 'local-deep', 'status', 'updates'].includes(kindName)) return setToast('Analyze a video on Home first.')
    try {
      setStudioBusy(kindName); setStudioResult('')
      if (kindName === 'subtitles') { await api.download_subtitles(media.url, settingsDraft.subtitleLanguage || 'en', 'srt'); setStudioResult(`Subtitles saved to ${settingsDraft.saveLocation}`) }
      if (kindName === 'package') setStudioResult(await api.ai_content_package(media.url, media.title))
      if (kindName.startsWith('skill-')) setStudioResult(await executeEmbeddedSkill(kindName.replace('skill-', '')))
      if (kindName === 'local-summary' || kindName === 'local-deep') setStudioResult(await api.analyze_local_video(localVideo, kindName === 'local-deep' ? 'deep' : 'summary'))
      if (kindName === 'status') setStudioResult(JSON.stringify(await api.get_system_status(), null, 2))
      if (kindName === 'updates') setStudioResult(JSON.stringify(await api.check_updates(), null, 2))
    } catch (error) { setToast(errorText(error)) } finally { setStudioBusy('') }
  }

  async function chooseLocalVideo() {
    const path = await api.choose_video_file(); if (path) setLocalVideo(path)
  }

  async function chooseConvertFiles() {
    const files = await api.choose_media_files()
    if (files?.length) setConvertFiles(files)
  }

  async function startConversions() {
    try {
      const result = await api.start_conversions(convertFiles, convertFormat)
      setToast(`${result.count} conversion${result.count === 1 ? '' : 's'} started`)
      setConvertFiles([])
    } catch (error) { setToast(errorText(error)) }
  }

  function applyRecipe(recipe) {
    const value = recipe.options || {}
    if (value.kind) setKind(value.kind)
    if (value.quality) setQuality(value.quality)
    if (value.format) setFormat(value.format)
    setSettingsDraft(current => ({ ...current, ...Object.fromEntries(Object.entries(value).filter(([key]) => ['subtitleLanguage','embedSubtitles','sponsorBlock','splitChapters'].includes(key))) }))
    setPage('Home')
    setToast(`${recipe.name} workflow applied`)
  }

  if (!boot || !settingsDraft) return <div className="splash"><div className="logo-mark"><Download size={32}/></div><LoaderCircle className="spin" size={30}/><p>Starting CPS Universal Downloader…</p></div>

  return <I18nContext.Provider value={t}><div className={`app ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <aside className="sidebar">
      <div className="brand"><div className="logo-mark"><Download size={27}/></div><div className="brand-copy"><strong>CPS Downloader</strong><span>PREMIUM</span></div></div>
      <nav>{pages.map(([name, Icon]) => <button key={name} title={t(name === 'AI' ? 'AI assistant' : name)} className={page === name ? 'active' : ''} onClick={() => setPage(name)}><Icon size={21}/><span>{t(name === 'AI' ? 'AI assistant' : name)}</span></button>)}</nav>
      <div className="sidebar-footer"><ShieldCheck size={18}/><span>{t('Private local workflow')}</span><small>© 2026 Chuob Piseth</small></div>
    </aside>

    <main>
      <header className="topbar">
        <div className="topbar-left"><IconButton onClick={() => setCollapsed(value => !value)}>{collapsed ? <ChevronRight/> : <ChevronLeft/>}</IconButton><strong>CPS Universal Downloader</strong><span className="pro-badge">PREMIUM</span></div>
        <div className="topbar-actions">
          {updateStatus?.available && (
            <button className="topbar-update-alert" onClick={() => setPage('Settings')} title={`Version ${updateStatus.latestVersion} available`}>
              <Sparkles size={14} className="sparkle-pulse" />
              <span>v{updateStatus.latestVersion} {t('Available')}</span>
            </button>
          )}
          <div className="select-shell language-select"><img className="language-flag" src={settingsDraft.language === 'Khmer' ? './flags/cambodia.svg' : './flags/us.svg'} alt=""/><select aria-label="Language" value={settingsDraft.language} onChange={event => setPreference('language', event.target.value)}><option value="English">English</option><option value="Khmer">ខ្មែរ</option></select></div><div className="select-shell">{theme === 'Dark' ? <Moon size={18}/> : theme === 'Liquid Glass' ? <Sparkles size={18}/> : <Sun size={18}/>}<select aria-label="Theme" value={theme} onChange={event => setPreference('theme', event.target.value)}><option value="System">{t('System')}</option><option value="Light">{t('Light')}</option><option value="Dark">{t('Dark')}</option><option value="Liquid Glass">{t('Liquid Glass')}</option></select></div>
        </div>
      </header>

      <div className="content">
        {updateStatus?.available && (
          <div className="update-notification-banner">
            <div className="banner-content">
              <Sparkles size={18} />
              <span><strong>{t('New Version Available:')}</strong> CPS Universal Downloader v{updateStatus.latestVersion} {t('is ready to install!')}</span>
            </div>
            <button className="banner-action-btn" onClick={() => setPage('Settings')}>
              {t('Update Now')}
            </button>
          </div>
        )}
        {page === 'Home' && <>
          <section className="hero">
            <div className="hero-content-wrap">
              <span className="eyebrow"><Sparkles size={15}/> {t('Fast • private • portable')}</span>
              <h1>{t('More than downloads.')} <em>{t('Create without limits.')}</em></h1>
              <p>{t('Download, convert, and understand video with AI—all in one private creative workspace.')}</p>
              <div className="platform-row">
                <PlatformLogo name="youtube" label="YouTube"/>
                <PlatformLogo name="tiktok" label="TikTok · Douyin"/>
                <PlatformLogo name="facebook" label="Facebook"/>
                <span className="more-platforms">{t('SharePoint + 1,000 sites')}</span>
              </div>

              <div className="hero-search-box">
                <div className="hero-search-bar">
                  <div className="hero-search-input-wrap">
                    <Link2 size={18} className="hero-search-icon" />
                    <input
                      className="hero-search-input"
                      value={url}
                      onChange={event => setUrl(event.target.value)}
                      onKeyDown={event => { if (event.key === 'Enter') analyze() }}
                      onPaste={event => {
                        const pasted = event.clipboardData?.getData('text') || ''
                        if (pasted.trim() && /^https?:\/\//i.test(pasted.trim())) {
                          setTimeout(() => catchPreviewAndAnalyze(pasted.trim()), 20)
                        }
                      }}
                      placeholder={t('Paste video URL, playlist, or multiple links here (YouTube, TikTok, Facebook…)')}
                    />
                    {url && (
                      <button
                        type="button"
                        className="hero-clear-btn"
                        onClick={() => { setUrl(''); setMedia(null); setPlaylistSelection([]); setHomeAiResult(null); setStatus('Ready') }}
                        title={t('Clear link')}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <div className="hero-search-actions">
                    <Button icon={Clipboard} onClick={paste} className="hero-btn paste-btn">{t('Paste')}</Button>
                    <Button icon={Search} variant="success" onClick={analyze} disabled={busy} className="hero-btn analyze-btn">
                      {busy ? t('Analyzing') + '…' : t('Analyze only')}
                    </Button>
                  </div>
                </div>
                {busy && (
                  <div className="hero-analysis-progress">
                    <div className="analysis-progress" aria-label="Analyzing"><span/></div>
                  </div>
                )}
                {status && (
                  <div className="hero-status-line">
                    {busy ? <LoaderCircle className="spin" size={14} /> : <Check size={14} />}
                    <span>{status}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="hero-orbit">
              <div className="orbit-ring"/>
              <div className="hero-download"><FontAwesomeIcon icon={faDownload}/></div>
            </div>
          </section>

          {media && (
            <div ref={mediaSectionRef} className="analyzed-media-container">
              <Card className="media-card">
                <div className="media-preview">
                  <div className="thumb-container">
                    <div className="thumb-wrap clickable" onClick={() => media.thumbnail && setViewingThumbnail(media.thumbnail)} title="Click to view full-size thumbnail">
                      {media.thumbnail ? <img src={media.thumbnail} alt={media.title}/> : <FileVideo size={48}/>}
                      {media.thumbnail && <div className="thumb-hover-overlay"><Eye size={22}/><span>{t('View Full')}</span></div>}
                      <div className="play-circle"><Play fill="currentColor"/></div>
                    </div>
                    {media.thumbnail && (
                      <div className="thumb-actions-bar">
                        <button type="button" className="thumb-btn view-btn" onClick={() => setViewingThumbnail(media.thumbnail)} title={t('View full-size')}>
                          <Eye size={13}/> {t('View Full')}
                        </button>
                        <button type="button" className="thumb-btn download-btn" onClick={() => saveThumbnailNow(media.thumbnail, media.title)} disabled={downloadingThumb} title={t('Download thumbnail image to your computer')}>
                          <Download size={13}/> {downloadingThumb ? t('Saving…') : t('Save Thumbnail')}
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="media-info">
                    <div className="media-kicker">{media.platform}</div>
                    <h2>{media.title}</h2>
                    <p className="creator">{media.creator}</p>
                    <div className="meta">
                      <span><Clock3/> {duration(media.duration)}</span>
                      <span><Activity/> {compactNumber(media.views)} views</span>
                      {media.entries.length > 0 && <span><ListChecks/> {media.entries.length} videos</span>}
                      <span><Captions/> {media.subtitles?.length || 0} subtitle tracks</span>
                      <span><ListVideo/> {media.chapters?.length || 0} chapters</span>
                    </div>
                    <p className="description">{media.description}</p>
                    <div className="media-ai-actions">
                      <Button icon={MessageCircle} onClick={() => runHomeAiSkill('summary')} disabled={Boolean(homeAiBusy)}>
                        {homeAiBusy === 'summary' ? t('Summarizing…') : t('Quick summary')}
                      </Button>
                      <Button icon={BrainCircuit} variant="primary" onClick={() => runHomeAiSkill('deep')} disabled={Boolean(homeAiBusy)}>
                        {homeAiBusy === 'deep' ? t('Analyzing deeply…') : t('Deep video analysis')}
                      </Button>
                      <Button icon={ImageIcon} onClick={() => runHomeAiSkill('thumbnail-review')} disabled={Boolean(homeAiBusy) || !media.thumbnail}>
                        {homeAiBusy === 'thumbnail-review' ? t('Reviewing thumbnail…') : t('Thumbnail review')}
                      </Button>
                      <Button icon={WandSparkles} onClick={() => runHomeAiSkill('thumbnail-prompt')} disabled={Boolean(homeAiBusy) || !media.thumbnail}>
                        {homeAiBusy === 'thumbnail-prompt' ? t('Generating prompt…') : t('Thumbnail prompt')}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>

              {media?.formats?.length > 0 ? (
                <FormatInspector
                  formats={media.formats}
                  formatId={formatId}
                  setFormatId={setFormatId}
                  onDownload={downloadNow}
                  t={t}
                />
              ) : busy ? (
                <Card className="format-inspector-card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '14px', justifyContent: 'center' }}>
                  <LoaderCircle className="spin" size={20} />
                  <span style={{ fontSize: '14px', fontWeight: 600 }}>{t('Analyzing link and loading available videos…')}</span>
                </Card>
              ) : null}

              {homeAiResult && (
                <Card className="home-ai-result">
                  <div className="card-title">
                    <div>
                      <span className="section-icon purple"><FontAwesomeIcon icon={faWandMagicSparkles}/></span>
                      <h2>{homeAiResult.title}</h2>
                      <p>{t('Generated with your selected AI provider and model.')}</p>
                    </div>
                    <Button icon={Copy} onClick={() => { navigator.clipboard.writeText(homeAiResult.text); setToast('AI result copied') }}>
                      {t('Copy result')}
                    </Button>
                  </div>
                  <div className="ai-result-text">{homeAiResult.text}</div>
                </Card>
              )}

              {media?.entries?.length > 0 && (
                <Card className="playlist-card">
                  <div className="card-title playlist-heading">
                    <div>
                      <h2>{t('Playlist videos')}</h2>
                      <p>{playlistSelection.length} of {media.entries.length} {t('selected · click any video to select or deselect it')}</p>
                    </div>
                    <div className="button-row">
                      <Button icon={Check} onClick={() => setPlaylistSelection(media.entries.map((_, index) => index))}>{t('Select all')}</Button>
                      <Button icon={X} onClick={() => setPlaylistSelection([])}>{t('Deselect all')}</Button>
                    </div>
                  </div>
                  <div className="playlist-grid">
                    {media.entries.map((item, index) => (
                      <button
                        key={`${item.url}-${index}`}
                        type="button"
                        aria-pressed={playlistSelection.includes(index)}
                        className={`playlist-item ${playlistSelection.includes(index) ? 'selected' : ''}`}
                        onClick={() => setPlaylistSelection(list => list.includes(index) ? list.filter(value => value !== index) : [...list, index])}
                      >
                        <div className="playlist-thumb">
                          {item.thumbnail ? <img src={item.thumbnail} alt=""/> : <div className="playlist-placeholder"><Play/></div>}
                          <span className="playlist-duration">{duration(item.duration)}</span>
                        </div>
                        <div className="playlist-copy">
                          <strong>{item.title}</strong>
                          <span>{item.platform || media.platform}</span>
                        </div>
                        <div className="check-dot">
                          {playlistSelection.includes(index) && <Check size={14}/>}
                        </div>
                      </button>
                    ))}
                  </div>
                </Card>
              )}
            </div>
          )}

          <div className="home-control-grid two-columns">
            <Card className="home-settings-card compact-card">
              <div className="card-title compact">
                <div>
                  <span className="section-icon purple"><Settings/></span>
                  <h2>{t('Download settings')}</h2>
                </div>
              </div>
              <label>{t('Type')}</label>
              <div className="segmented">
                <button className={kind === 'Video' ? 'selected' : ''} onClick={() => { setKind('Video'); if (!videoFormats.includes(format)) setFormat('MP4') }}><FileVideo/> {t('Video')}</button>
                <button className={kind === 'Audio' ? 'selected' : ''} onClick={() => { setKind('Audio'); if (!audioFormats.includes(format)) setFormat('MP3') }}><FileAudio/> {t('Audio')}</button>
              </div>
              <div className="field-grid">
                <label>{t('Quality')}<select value={quality} onChange={event => { setQuality(event.target.value); setFormatId('') }} disabled={kind === 'Audio'}>{qualities.map(value => <option key={value}>{value}</option>)}</select></label>
                <label>{t('Format')}<select value={format} onChange={event => setFormat(event.target.value)}>{(kind === 'Video' ? videoFormats : audioFormats).map(value => <option key={value}>{value}</option>)}</select></label>
              </div>
              <div className="field-grid clip-fields">
                <label>{t('Clip start')}<input value={startTime} onChange={event => setStartTime(event.target.value)} placeholder="00:00"/></label>
                <label>{t('Clip end')}<input value={endTime} onChange={event => setEndTime(event.target.value)} placeholder={t('Full video')}/></label>
              </div>
            </Card>

            <Card className="home-presets-card compact-card">
              <div className="card-title compact">
                <div>
                  <span className="section-icon orange"><FontAwesomeIcon icon={faBolt}/></span>
                  <h2>{t('Quick presets')}</h2>
                </div>
              </div>
              <Button icon={Download} variant="primary" className="home-download-button" onClick={downloadNow} disabled={busy || (!media && !url) || Boolean(media?.entries?.length && playlistSelection.length === 0)}>
                {busy ? t('Working…') : media?.entries?.length ? `${t('Download')} ${playlistSelection.length} ${t('selected')}` : t('Download now')}
              </Button>
              <div className="preset-grid">
                <button onClick={() => { setKind('Video'); setQuality('Best'); setFormat('MP4') }}><Sparkles/> {t('Best')}</button>
                <button onClick={() => { setKind('Video'); setQuality('1080p'); setFormat('MP4') }}><Zap/> 1080p</button>
                <button onClick={() => { setKind('Video'); setQuality('720p'); setFormat('MP4') }}><Gauge/> {t('Small')}</button>
                <button onClick={() => { setKind('Audio'); setFormat('MP3') }}><FontAwesomeIcon icon={faMusic}/> MP3</button>
              </div>
              <p className="analyze-safety">{t('Analyze only previews media. Downloads start only after you select videos and click this button.')}</p>
              <div className="save-location">
                <span>{t('Saving to')}</span>
                <strong title={settingsDraft.saveLocation}>{settingsDraft.saveLocation}</strong>
                <div className="save-location-btns">
                  <button type="button" className="save-change-folder-btn" onClick={browse} title={t('Change destination folder')}>{t('Change')}</button>
                  <IconButton onClick={() => api.open_download_folder()} title={t('Open download folder')}><FolderOpen/></IconButton>
                </div>
              </div>
            </Card>
          </div>

        </>}

        {page === 'Downloads' && <DownloadsPage active={active} history={history} tab={downloadTab} setTab={setDownloadTab} api={api} running={running}/>} 
        {page === 'Queue' && <QueuePage queue={queue} updateItem={updateItem} api={api} startSelected={startSelected}/>} 
        {page === 'History' && <HistoryPage history={history} activity={activity} api={api}/>} 
        {page === 'Convert' && <ConverterPage files={convertFiles} setFiles={setConvertFiles} format={convertFormat} setFormat={setConvertFormat} conversions={conversions} choose={chooseConvertFiles} start={startConversions} api={api} outputLocation={settingsDraft.conversionLocation} browseOutput={browseConversion}/>} 
        {page === 'Studio' && <StudioPage media={media} settings={settingsDraft} result={studioResult} busy={studioBusy} run={runStudio} localVideo={localVideo} chooseLocal={chooseLocalVideo} api={api} downloadOptions={options()} recipes={recipes} setRecipes={setRecipes} applyRecipe={applyRecipe} openQueue={() => setPage('Queue')} setToast={setToast}/>} 
        {page === 'Settings' && <SettingsPage draft={settingsDraft} setDraft={setSettingsDraft} browse={browse} browseConversion={browseConversion} save={saveSettings} models={models} loadModels={loadModels} busy={busy} aiConnection={aiConnection} extensionConnection={extensionConnection} testExtension={testExtension} setTheme={setTheme} api={api} geminiKeys={geminiKeys} setGeminiKeys={setGeminiKeys} localAiStatus={localAiStatus} updateStatus={updateStatus} checkUpdate={checkAppUpdate} installUpdate={installAppUpdate}/>} 
        {page === 'AI' && <AiPage messages={messages} input={aiInput} setInput={setAiInput} video={aiVideo} setVideo={setAiVideo} send={sendAi} useCurrent={() => setAiVideo(media?.url || url)} grounded={aiGrounded} setGrounded={setAiGrounded}/>} 
        {page === 'About' && <AboutPage boot={boot} api={api}/>} 
      </div>
    </main>
    {viewingThumbnail && (
      <div className="thumbnail-lightbox-backdrop" onClick={() => setViewingThumbnail(null)}>
        <div className="thumbnail-lightbox-modal" onClick={e => e.stopPropagation()}>
          <div className="lightbox-header">
            <div className="lightbox-title">
              <ImageIcon size={18}/>
              <span>{media?.title || 'Video Thumbnail'}</span>
            </div>
            <IconButton onClick={() => setViewingThumbnail(null)} title={t('Close')}><X/></IconButton>
          </div>
          <div className="lightbox-body">
            <img src={viewingThumbnail} alt="Thumbnail preview"/>
          </div>
          <div className="lightbox-footer">
            <span className="lightbox-meta">{media?.platform || 'Video'} • High Resolution Preview</span>
            <div className="button-row">
              <Button icon={Copy} onClick={() => { navigator.clipboard.writeText(viewingThumbnail); setToast('Thumbnail link copied') }}>{t('Copy Link')}</Button>
              <Button icon={Download} variant="primary" onClick={() => saveThumbnailNow(viewingThumbnail, media?.title)} disabled={downloadingThumb}>
                {downloadingThumb ? t('Saving…') : t('Download Thumbnail')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )}
    {toast && <div className="toast"><Check size={18}/>{toast}</div>}
  </div></I18nContext.Provider>
}

function FormatInspector({ formats, formatId, setFormatId, onDownload, t }) {
  const [filter, setFilter] = useState('all')

  const processed = useMemo(() => {
    return (formats || []).map(item => {
      const isVideo = item.videoCodec && item.videoCodec !== 'none'
      const isAudio = item.audioCodec && item.audioCodec !== 'none'
      const isBoth = isVideo && isAudio
      const isAudioOnly = !isVideo && (isAudio || item.resolution === 'audio only')
      const isVideoOnly = isVideo && !isAudio
      return { ...item, isBoth, isAudioOnly, isVideoOnly }
    })
  }, [formats])

  const counts = useMemo(() => ({
    all: processed.length,
    both: processed.filter(f => f.isBoth).length,
    video: processed.filter(f => f.isVideoOnly).length,
    audio: processed.filter(f => f.isAudioOnly).length
  }), [processed])

  const filtered = useMemo(() => {
    if (filter === 'both') return processed.filter(f => f.isBoth)
    if (filter === 'video') return processed.filter(f => f.isVideoOnly)
    if (filter === 'audio') return processed.filter(f => f.isAudioOnly)
    return processed
  }, [processed, filter])

  return (
    <Card className="format-inspector-card">
      <div className="card-title format-inspector-header">
        <div>
          <h2>{t('Format inspector')}</h2>
          <p>{t('Choose an exact media stream below or keep automatic Best quality.')}</p>
        </div>
        <Button
          icon={Sparkles}
          variant={!formatId ? 'primary' : 'soft'}
          onClick={() => setFormatId('')}
          className="format-auto-btn"
        >
          {!formatId ? t('✓ Automatic Best (Active)') : t('Reset to Automatic Best')}
        </Button>
      </div>

      <div className="format-filter-bar">
        <button
          type="button"
          className={`format-filter-pill ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          {t('All Streams')} <span className="filter-count">{counts.all}</span>
        </button>
        <button
          type="button"
          className={`format-filter-pill ${filter === 'both' ? 'active' : ''}`}
          onClick={() => setFilter('both')}
        >
          <Film size={14} /> {t('Video + Audio')} <span className="filter-count">{counts.both}</span>
        </button>
        <button
          type="button"
          className={`format-filter-pill ${filter === 'video' ? 'active' : ''}`}
          onClick={() => setFilter('video')}
        >
          <Video size={14} /> {t('Video Only')} <span className="filter-count">{counts.video}</span>
        </button>
        <button
          type="button"
          className={`format-filter-pill ${filter === 'audio' ? 'active' : ''}`}
          onClick={() => setFilter('audio')}
        >
          <Volume2 size={14} /> {t('Audio Only')} <span className="filter-count">{counts.audio}</span>
        </button>
      </div>

      <div className="format-list-container">
        {filtered.map(item => (
          <div
            key={item.id}
            className={`format-list-row ${formatId === item.id ? 'selected' : ''}`}
            onClick={() => setFormatId(item.id)}
          >
            <div className="format-type-indicator">
              {item.isBoth ? (
                <div className="stream-badge-icon complete" title="Complete stream with video and audio">
                  <Film size={18} />
                </div>
              ) : item.isVideoOnly ? (
                <div className="stream-badge-icon video" title="Video stream only (muted). Download engine merges audio automatically when possible">
                  <Video size={18} />
                </div>
              ) : (
                <div className="stream-badge-icon audio" title="Audio / music stream only">
                  <Volume2 size={18} />
                </div>
              )}
              <div className="stream-kind-labels">
                <span className={`stream-kind-pill ${item.isBoth ? 'complete' : item.isVideoOnly ? 'video' : 'audio'}`}>
                  {item.isBoth ? t('Video + Audio') : item.isVideoOnly ? t('Video Only') : t('Audio Only')}
                </span>
                {item.hdr && item.hdr !== 'SDR' && <span className="stream-hdr-pill">{item.hdr}</span>}
              </div>
            </div>

            <div className="format-quality-info">
              <div className="format-res-line">
                <strong className="format-res-title">{item.resolution}</strong>
                {item.fps && <span className="format-fps-tag">{item.fps} FPS</span>}
              </div>
              <span className="format-codec-meta">
                {item.isBoth ? `Codecs: ${item.videoCodec} / ${item.audioCodec}` : item.isVideoOnly ? `Codec: ${item.videoCodec}` : `Codec: ${item.audioCodec}`}
              </span>
            </div>

            <div className="format-extension-badge">
              <span className="ext-pill">.{item.extension.toUpperCase()}</span>
              <span className="proto-meta">{item.protocol || 'Direct'}</span>
            </div>

            <div className="format-size-info">
              <strong>{item.size ? `${(item.size / 1048576).toFixed(1)} MB` : 'Dynamic size'}</strong>
              <small>{item.bitrate ? `${Math.round(item.bitrate)} kbps` : 'Variable bitrate'}</small>
            </div>

            <div className="format-select-action">
              <button
                type="button"
                className={`format-row-btn ${formatId === item.id ? 'active' : ''}`}
                onClick={e => { e.stopPropagation(); setFormatId(item.id); }}
                title={formatId === item.id ? t('Selected') : t('Select')}
              >
                {formatId === item.id ? <><Check size={13} /> {t('Selected')}</> : t('Select')}
              </button>
              {onDownload && (
                <button
                  type="button"
                  className="format-row-btn download-direct-btn"
                  onClick={e => { e.stopPropagation(); setFormatId(item.id); onDownload(item.id); }}
                  title={t('Download this format')}
                >
                  <Download size={13} /> {t('Download')}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function DownloadsPage({ active, history, tab, setTab, api, running }) {
  const t = useContext(I18nContext)
  const stopped = active.filter(item => ['Failed', 'Cancelled', 'Paused'].includes(item.status)).length
  return <><PageHeader title="Downloads" subtitle="Follow current transfers or reopen completed files" action={<Button icon={FolderOpen} onClick={() => api.open_download_folder()}>Open download folder</Button>}/><div className="tabs"><button className={tab === 'Current' ? 'active' : ''} onClick={() => setTab('Current')}><Download/> {t('Current downloading')}</button><button className={tab === 'Downloaded' ? 'active' : ''} onClick={() => setTab('Downloaded')}><Check/> {t('Downloaded')}</button></div>{tab === 'Current' ? <Card><div className="card-title"><div><h2>{t('Current downloading')}</h2><p>{t('Parallel, resumable transfers with live processing states')}</p></div><div className="button-row">{stopped > 0 && <Button icon={Trash2} onClick={() => api.clear_stopped_downloads()}>{t('Clear stopped/errors')} ({stopped})</Button>}<Button icon={PauseCircle} variant="danger" onClick={() => api.cancel_downloads()} disabled={!running}>{t('Stop all')}</Button></div></div>{active.length ? <DownloadTable items={active} api={api}/> : <Empty title="Nothing downloading" text="Start a download from Home or the Queue."/>}</Card> : <Card><div className="card-title"><div><h2>{t('Downloaded files')}</h2><p>{history.length} {t('completed items')}</p></div></div>{history.length ? <DownloadTable items={history} completed api={api}/> : <Empty icon={History} title="No downloads yet" text="Completed files will appear here."/>}</Card>}</>
}

function DownloadTable({ items, completed = false, api }) {
  const t = useContext(I18nContext)
  return <div className="table-wrap"><table><thead><tr><th>{t('Video')}</th><th>{t('Platform')}</th><th>{t('Quality')}</th>{!completed && <><th>{t('Progress')}</th><th>{t('Speed')}</th><th>{t('ETA')}</th><th>{t('Status')}</th><th>{t('Actions')}</th></>}{completed && <><th>{t('Completed')}</th><th>{t('File')}</th></>}</tr></thead><tbody>{items.map(item => <tr key={item.id}><td><strong>{item.title}</strong>{item.error && <small className="error-text">{item.error}</small>}</td><td><span className="platform-pill">{item.platform || 'Video'}</span></td><td>{item.quality}</td>{!completed && <><td><Progress value={item.progress}/></td><td>{item.speed}</td><td>{item.eta}</td><td><span className={`status ${item.status.toLowerCase()}`}>{t(item.status) || item.status}</span></td><td>{['Failed', 'Cancelled', 'Paused', 'Waiting'].includes(item.status) && <IconButton className="danger-text" title={t('Remove this download')} onClick={() => api.remove_queue_item(item.id)}><Trash2/></IconButton>}</td></>}{completed && <><td>{new Date(item.completedAt || item.createdAt).toLocaleString()}</td><td><IconButton title={t('Show downloaded file in folder')} onClick={() => api.show_in_folder(item.outputPath)}><FolderOpen/></IconButton></td></>}</tr>)}</tbody></table></div>
}

function QueuePage({ queue, updateItem, api, startSelected }) {
  const t = useContext(I18nContext)
  const waiting = queue.filter(item => item.status !== 'Completed')
  return <><PageHeader title="Download queue" subtitle="Select items, adjust priority, and recover failed transfers" action={<Button icon={RotateCcw} onClick={() => api.retry_failed_items('resume')}>Recover all failed</Button>}/><Card><div className="card-title"><div className="button-row"><Button icon={Check} onClick={() => waiting.forEach(item => updateItem(item.id, { selected: true }))}>Select all</Button><Button icon={X} onClick={() => waiting.forEach(item => updateItem(item.id, { selected: false }))}>Clear</Button><Button icon={Download} variant="primary" onClick={startSelected}>Download selected</Button></div><Button icon={Trash2} onClick={() => api.clear_completed()}>Remove completed</Button></div>{waiting.length ? <div className="table-wrap"><table><thead><tr><th>{t('Select')}</th><th>{t('Video')}</th><th>{t('Type')}</th><th>{t('Quality')}</th><th>{t('Priority')}</th><th>{t('Status')}</th><th>{t('Actions')}</th></tr></thead><tbody>{waiting.map(item => <tr key={item.id}><td><input type="checkbox" checked={item.selected} onChange={event => updateItem(item.id, { selected: event.target.checked })}/></td><td><strong>{item.title}</strong>{item.recovery && <small className="recovery-text">{item.recovery.action}</small>}</td><td>{item.kind}</td><td>{item.quality}</td><td><select value={item.priority} onChange={event => updateItem(item.id, { priority: Number(event.target.value) })}><option value="0">{t('Low')}</option><option value="3">{t('Normal')}</option><option value="7">{t('High')}</option></select></td><td><span className={`status ${item.status.toLowerCase()}`}>{t(item.status) || item.status}</span></td><td><div className="row-actions">{['Failed','Cancelled'].includes(item.status) && <><IconButton title={t('Resume with the same settings')} onClick={() => api.retry_queue_item(item.id, 'resume')}><RefreshCw/></IconButton><IconButton title={t('Retry with automatic best format')} onClick={() => api.retry_queue_item(item.id, 'best')}><Sparkles/></IconButton><IconButton title={t('Safe retry at 720p')} onClick={() => api.retry_queue_item(item.id, 'safe')}><ShieldCheck/></IconButton></>}<IconButton className="danger-text" title={t('Remove this download')} onClick={() => api.remove_queue_item(item.id)}><Trash2/></IconButton></div></td></tr>)}</tbody></table></div> : <Empty icon={ListChecks} title="Queue is clear" text="Paste multiple links or add a playlist from Home."/>}</Card></>
}

function HistoryPage({ history, activity, api }) {
  const t = useContext(I18nContext)
  const [tab, setTab] = useState('Downloads')
  return <><PageHeader title="History & activity" subtitle="Completed files and a persistent diagnostic log"/><div className="tabs"><button className={tab === 'Downloads' ? 'active' : ''} onClick={() => setTab('Downloads')}><History/> {t('Download history')} <span>{history.length}</span></button><button className={tab === 'Activity' ? 'active' : ''} onClick={() => setTab('Activity')}><ListChecks/> {t('Activity log')} <span>{activity.length}</span></button></div>{tab === 'Downloads' ? <Card><div className="card-title"><div><h2>{t('Completed downloads')}</h2><p>{t('Saved across app restarts with the exact final file path.')}</p></div>{history.length > 0 && <Button icon={Trash2} onClick={() => api.clear_history()}>{t('Clear history')}</Button>}</div>{history.length ? <DownloadTable items={history} completed api={api}/> : <Empty icon={History} title="No history yet" text="Successfully completed downloads will appear here."/>}</Card> : <Card><div className="card-title"><div><h2>{t('Activity log')}</h2><p>{t('Analysis, queue, download, completion, cancellation, and error events.')}</p></div>{activity.length > 0 && <Button icon={Trash2} onClick={() => api.clear_activity_log()}>{t('Clear log')}</Button>}</div>{activity.length ? <div className="table-wrap"><table className="activity-table"><thead><tr><th>{t('Time')}</th><th>{t('Level')}</th><th>{t('Event')}</th><th>{t('Item')}</th><th>{t('Message')}</th></tr></thead><tbody>{activity.map(item => <tr key={item.id}><td>{new Date(item.timestamp).toLocaleString()}</td><td><span className={`log-level ${item.level}`}>{item.level}</span></td><td>{item.event}</td><td><strong>{item.title || 'Application'}</strong></td><td><div className="log-message" title={item.message}>{item.message}</div></td></tr>)}</tbody></table></div> : <Empty icon={ListChecks} title="No activity yet" text="New actions and diagnostics will be recorded here."/>}</Card>}</>
}

function ConverterPage({ files, setFiles, format, setFormat, conversions, choose, start, api, outputLocation, browseOutput }) {
  const t = useContext(I18nContext)
  const formats = ['MP4', 'MOV', 'MKV', 'WEBM', 'MP3', 'OGG', 'WAV', 'FLAC', 'M4A', 'JPG', 'PNG', 'GIF']
  return <><PageHeader title="Media converter" subtitle="Convert video, audio, and images locally with the bundled FFmpeg engine."/>
    <div className="converter-layout">
      <Card className="converter-setup"><div className="converter-icon"><RotateCcw size={30}/></div><h2>{t('Choose files')}</h2><p className="hint">{t('MOV, HEIC, MP4, MKV, audio, and image files are supported when their codec is available in FFmpeg.')}</p><Button icon={FolderOpen} onClick={choose}>{t('Choose files')}</Button><div className="selected-files">{files.length ? files.map((path, index) => <div key={path}><FileVideo/><span title={path}>{path.split(/[\\/]/).pop()}</span><IconButton onClick={() => setFiles(current => current.filter((_, value) => value !== index))}><X/></IconButton></div>) : <Empty icon={FileVideo} title="No files selected" text="Choose one or more files from your computer."/>}</div></Card>
      <Card className="converter-options"><h2>{t('Output format')}</h2><div className="format-choice-grid">{formats.map(value => <button key={value} className={format === value ? 'selected' : ''} onClick={() => setFormat(value)}>{['MP3','OGG','WAV','FLAC','M4A'].includes(value) ? <FileAudio/> : <FileVideo/>}<span>{value}</span></button>)}</div><div className="converter-destination"><span>{t('Save converted files to')}</span><strong title={outputLocation}>{outputLocation}</strong><div className="button-row"><Button icon={FolderOpen} onClick={browseOutput}>{t('Change folder')}</Button><Button icon={FolderOpen} onClick={() => api.open_conversion_folder()}>{t('Open folder')}</Button></div></div><Button icon={RotateCcw} variant="primary" className="convert-start" onClick={start} disabled={!files.length}>{t('Start conversion')}</Button><p className="hint">{t('Existing files are never overwritten.')}</p></Card>
    </div>
    <Card><div className="card-title"><div><h2>{t('Conversion jobs')}</h2><p>{conversions.length} {t('files')}</p></div></div>{conversions.length ? <div className="table-wrap"><table className="conversion-table"><thead><tr><th>{t('Source')}</th><th>{t('Format')}</th><th>{t('Progress')}</th><th>{t('Status')}</th><th>{t('Output file')}</th><th>{t('Actions')}</th></tr></thead><tbody>{conversions.map(item => <tr key={item.id}><td><strong>{item.name}</strong>{item.error && <small className="error-text">{item.error}</small>}</td><td>{item.format}</td><td><Progress value={item.progress}/></td><td><span className={`status ${item.status.toLowerCase()}`}>{t(item.status) || item.status}</span></td><td><small className="output-file" title={item.outputPath}>{item.outputPath?.split(/[\\/]/).pop()}</small></td><td><div className="row-actions">{item.status === 'Completed' && <IconButton title={t('Show converted file in folder')} onClick={() => api.show_in_folder(item.outputPath)}><FolderOpen/></IconButton>}{['Waiting','Converting'].includes(item.status) && <IconButton title={t('Cancel')} onClick={() => api.cancel_conversion(item.id)}><X/></IconButton>}<IconButton className="danger-text" title={t('Remove')} onClick={() => api.remove_conversion(item.id)}><Trash2/></IconButton></div></td></tr>)}</tbody></table></div> : <Empty icon={RotateCcw} title="No conversion jobs" text="Choose local files and select an output format to begin."/>}</Card>
  </>
}

function StudioPage({ media, settings, result, busy, run, localVideo, chooseLocal, api, downloadOptions, recipes, setRecipes, applyRecipe, openQueue, setToast }) {
  const [tab, setTab] = useState(() => new URLSearchParams(location.search).get('studioTab') || 'Clips')
  const [clipMode, setClipMode] = useState('highlights')
  const [clips, setClips] = useState([])
  const [clipBusy, setClipBusy] = useState(false)
  const [verticalClips, setVerticalClips] = useState(true)
  const [removeSilence, setRemoveSilence] = useState(false)
  const [addHookCaption, setAddHookCaption] = useState(true)
  const [subtitleText, setSubtitleText] = useState('')
  const [subtitleLanguage, setSubtitleLanguage] = useState(settings.subtitleLanguage || 'en')
  const [targetLanguage, setTargetLanguage] = useState('Khmer')
  const [bilingual, setBilingual] = useState(true)
  const [subtitleBusy, setSubtitleBusy] = useState('')
  const [recipeName, setRecipeName] = useState('')

  async function createClips() {
    if (!media?.url) return setToast('Analyze a video on Home first.')
    try { setClipBusy(true); setClips(await api.suggest_smart_clips(media.url, media.title, clipMode, subtitleLanguage)); setToast('Smart clip suggestions are ready') }
    catch (error) { setToast(errorText(error)) } finally { setClipBusy(false) }
  }
  async function queueClips() {
    const selected = clips.filter(clip => clip.selected)
    if (!selected.length) return setToast('Select at least one clip.')
    try {
      const value = await api.add_clip_jobs({ url: media.url, title: media.title, platform: media.platform, thumbnail: media.thumbnail }, selected, { ...downloadOptions, smartVertical: verticalClips, removeSilence, addHookCaption })
      setToast(`${value.count} smart clips added to the queue`); openQueue()
    } catch (error) { setToast(errorText(error)) }
  }
  async function loadSubtitles() {
    if (!media?.url) return setToast('Analyze a video on Home first.')
    try { setSubtitleBusy('load'); const value = await api.load_subtitle_text(media.url, subtitleLanguage, 'srt'); setSubtitleText(value.text); setToast('Subtitles loaded into the editor') }
    catch (error) { setToast(errorText(error)) } finally { setSubtitleBusy('') }
  }
  async function translateSubtitles() {
    try { setSubtitleBusy('translate'); setSubtitleText(await api.translate_subtitle_text(subtitleText, targetLanguage, bilingual)); setToast(`Translated to ${targetLanguage}`) }
    catch (error) { setToast(errorText(error)) } finally { setSubtitleBusy('') }
  }
  async function saveSubtitles() {
    try { const value = await api.save_subtitle_text(media?.title || 'Edited subtitles', subtitleText, 'srt'); setToast(`Saved ${value.path}`) }
    catch (error) { setToast(errorText(error)) }
  }
  async function burnSubtitles() {
    try { setSubtitleBusy('burn'); const value = await api.burn_subtitle_text(localVideo, media?.title || 'Subtitles', subtitleText); setToast(`Created ${value.path}`) }
    catch (error) { setToast(errorText(error)) } finally { setSubtitleBusy('') }
  }
  async function saveRecipe() {
    try { setRecipes(await api.save_workflow_recipe(recipeName, downloadOptions)); setRecipeName(''); setToast('Workflow recipe saved') }
    catch (error) { setToast(errorText(error)) }
  }
  async function deleteRecipe(id) { setRecipes(await api.delete_workflow_recipe(id)) }
  async function exportPack() {
    try { const value = await api.save_creator_pack(media?.title || 'Video', result); setToast(`Creator pack saved to ${value.path}`) }
    catch (error) { setToast(errorText(error)) }
  }

  const t = useContext(I18nContext)
  return <><PageHeader title="Creator studio" subtitle="Turn one video into clips, subtitles, creator assets, and reusable workflows" action={<div className="button-row"><Button icon={PackageOpen} onClick={() => run('status')}>System status</Button><Button icon={RefreshCw} onClick={() => run('updates')}>Check updates</Button></div>}/>
    <div className="studio-tabs">{[['Clips',Scissors],['Subtitles',Captions],['Creator Pack',Sparkles],['Recipes',ListChecks],['AI Skills',BrainCircuit]].map(([name, Icon]) => <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}><Icon/>{t(name)}</button>)}</div>

    {tab === 'Clips' && <Card><div className="card-title"><div><span className="section-icon orange"><Scissors/></span><h2>Smart Clip Maker</h2><p>AI finds complete, standalone moments using transcript timestamps. Nothing downloads until you queue selected clips.</p></div><Button icon={BrainCircuit} variant="primary" onClick={createClips} disabled={clipBusy || !media}>{clipBusy ? 'Finding moments…' : 'Find smart clips'}</Button></div><div className="clip-controls"><label>Clip style<select value={clipMode} onChange={event => setClipMode(event.target.value)}><option value="highlights">Best highlights</option><option value="educational moments">Educational points</option><option value="short-form hooks">Short-form hooks</option><option value="funny moments">Funny moments</option></select></label><label>Transcript language<input value={subtitleLanguage} onChange={event => setSubtitleLanguage(event.target.value)} placeholder="en, km…"/></label></div><div className="clip-output-options"><label className="check-label"><input type="checkbox" checked={verticalClips} onChange={event => setVerticalClips(event.target.checked)}/> Resize and pad to vertical 9:16</label><label className="check-label"><input type="checkbox" checked={addHookCaption} onChange={event => setAddHookCaption(event.target.checked)}/> Add the AI hook caption</label><label className="check-label"><input type="checkbox" checked={removeSilence} onChange={event => setRemoveSilence(event.target.checked)}/> Remove silent gaps</label></div>{clips.length ? <><div className="clip-list">{clips.map(clip => <label key={clip.id} className={`clip-item ${clip.selected ? 'selected' : ''}`}><input type="checkbox" checked={clip.selected} onChange={event => setClips(current => current.map(value => value.id === clip.id ? { ...value, selected: event.target.checked } : value))}/><div><strong>{clip.title}</strong><span>{clip.start} → {clip.end}</span><p>{clip.reason}</p><small>{clip.caption}</small></div></label>)}</div><Button icon={Download} variant="primary" onClick={queueClips}>Add selected clips to queue</Button></> : <Empty icon={Scissors} title="No smart clips yet" text="Analyze a video with subtitles, choose a clip style, and find its strongest moments."/>}</Card>}

    {tab === 'Subtitles' && <Card><div className="card-title"><div><span className="section-icon cyan"><Captions/></span><h2>Khmer Subtitle Studio</h2><p>Load, edit, translate, export, or burn subtitles into a local video.</p></div><div className="button-row"><Button icon={Download} onClick={loadSubtitles} disabled={!media || Boolean(subtitleBusy)}>{subtitleBusy === 'load' ? 'Loading…' : 'Load from video'}</Button><Button icon={Save} onClick={saveSubtitles} disabled={!subtitleText}>Save SRT</Button></div></div><div className="subtitle-toolbar"><label>Source track<input value={subtitleLanguage} onChange={event => setSubtitleLanguage(event.target.value)} placeholder="en, en.*, km"/></label><label>Translate to<input value={targetLanguage} onChange={event => setTargetLanguage(event.target.value)} placeholder="Khmer"/></label><label className="check-label"><input type="checkbox" checked={bilingual} onChange={event => setBilingual(event.target.checked)}/> Keep original + translation</label><Button icon={Languages} variant="primary" onClick={translateSubtitles} disabled={!subtitleText || Boolean(subtitleBusy)}>{subtitleBusy === 'translate' ? 'Translating…' : 'Translate subtitles'}</Button></div><textarea className="subtitle-editor" value={subtitleText} onChange={event => setSubtitleText(event.target.value)} placeholder={'1\n00:00:01,000 --> 00:00:04,000\nSubtitle text…'}/><div className="burn-row"><div className="input-action"><input value={localVideo} readOnly placeholder="Choose the local video that matches these subtitles"/><Button icon={FolderOpen} onClick={chooseLocal}>Choose video</Button></div><Button icon={Film} variant="success" onClick={burnSubtitles} disabled={!localVideo || !subtitleText || Boolean(subtitleBusy)}>{subtitleBusy === 'burn' ? 'Rendering video…' : 'Burn subtitles into MP4'}</Button></div></Card>}

    {tab === 'Creator Pack' && <><div className="studio-grid"><Card><div className="card-title"><div><span className="section-icon purple"><BrainCircuit/></span><h2>Complete Creator Pack</h2><p>Summary, chapters, titles, description, captions, hashtags, and a thumbnail prompt.</p></div></div><Button icon={Sparkles} variant="primary" onClick={() => run('package')} disabled={Boolean(busy) || !media}>{busy === 'package' ? 'Building package…' : 'Generate complete package'}</Button></Card><Card><div className="card-title"><div><span className="section-icon orange"><ListVideo/></span><h2>Detected chapters</h2><p>{media?.chapters?.length || 0} available</p></div></div><div className="chapter-list">{media?.chapters?.slice(0, 8).map((chapter, index) => <div key={index}><strong>{chapter.title}</strong><span>{duration(chapter.start)} – {chapter.end ? duration(chapter.end) : 'end'}</span></div>)}</div></Card></div>{result && <Card className="studio-result"><div className="card-title"><h2>Creator Pack result</h2><div className="button-row"><Button icon={Copy} onClick={() => navigator.clipboard.writeText(result)}>Copy</Button><Button icon={Save} variant="primary" onClick={exportPack}>Export Markdown</Button></div></div><pre>{result}</pre></Card>}</>}

    {tab === 'Recipes' && <><Card className="recipe-create"><div><h2>Save the current Home workflow</h2><p className="hint">Stores format, quality, subtitle, SponsorBlock, and chapter choices. Applying a recipe never starts a download.</p></div><div className="input-action"><input value={recipeName} onChange={event => setRecipeName(event.target.value)} placeholder="My workflow name"/><Button icon={Save} variant="primary" onClick={saveRecipe} disabled={!recipeName.trim()}>Save recipe</Button></div></Card><div className="recipe-grid">{recipes.map(recipe => <Card key={recipe.id} className="recipe-card"><div className="recipe-icon"><Zap/></div><h2>{recipe.name}</h2><p>{recipe.description}</p><div className="recipe-options">{Object.entries(recipe.options || {}).filter(([,value]) => value !== false && value !== '').map(([key,value]) => <span key={key}>{key}: {String(value)}</span>)}</div><div className="button-row"><Button icon={Check} variant="primary" onClick={() => applyRecipe(recipe)}>Apply on Home</Button>{!recipe.builtIn && <IconButton className="danger-text" title="Delete recipe" onClick={() => deleteRecipe(recipe.id)}><Trash2/></IconButton>}</div></Card>)}</div></>}

    {tab === 'AI Skills' && <><Card><div className="card-title"><div><span className="section-icon purple"><BrainCircuit/></span><h2>Embedded AI Skills</h2><p>Summarize and deeply understand the analyzed video, or review its thumbnail and create a production-ready visual prompt.</p></div></div><div className="ai-skill-grid"><button onClick={() => run('skill-summary')} disabled={!media || Boolean(busy)}><MessageCircle/><strong>Quick summary</strong><span>Key points, facts, takeaways, and suggested chapters.</span></button><button onClick={() => run('skill-deep')} disabled={!media || Boolean(busy)}><BrainCircuit/><strong>Deep video analysis</strong><span>Meaning, chronology, claims, audience, tone, and conclusions.</span></button><button onClick={() => run('skill-thumbnail-review')} disabled={!media?.thumbnail || Boolean(busy)}><ImageIcon/><strong>Thumbnail review</strong><span>Composition, contrast, readability, emotional hook, and improvements.</span></button><button onClick={() => run('skill-thumbnail-prompt')} disabled={!media?.thumbnail || Boolean(busy)}><WandSparkles/><strong>Thumbnail prompt</strong><span>A detailed 16:9 prompt ready for an image generator.</span></button></div>{busy?.startsWith('skill-') && <div className="skill-working"><LoaderCircle className="spin"/> Running embedded AI skill…</div>}</Card><Card><div className="card-title"><div><span className="section-icon cyan"><MonitorUp/></span><h2>Local-video analysis</h2><p>Analyze a selected video with your configured Gemini account. Choose a file under 20 MB.</p></div></div><div className="input-action"><input value={localVideo} readOnly placeholder="Choose a local video under 20 MB"/><Button icon={FolderOpen} onClick={chooseLocal}>Choose</Button></div><div className="button-row spaced-actions"><Button icon={MessageCircle} onClick={() => run('local-summary')} disabled={!localVideo || Boolean(busy)}>Summary</Button><Button icon={Search} onClick={() => run('local-deep')} disabled={!localVideo || Boolean(busy)}>Deep analysis</Button></div></Card>{result && <Card className="studio-result"><div className="card-title"><h2>AI Skill result</h2><Button icon={Copy} onClick={() => navigator.clipboard.writeText(result)}>Copy</Button></div><pre>{result}</pre></Card>}</>}
  </>
}

function SettingsPage({ draft, setDraft, browse, browseConversion, save, models, loadModels, busy, aiConnection, extensionConnection, testExtension, setTheme, api, geminiKeys, setGeminiKeys, localAiStatus, updateStatus, checkUpdate, installUpdate }) {
  const t = useContext(I18nContext)
  const set = (key, value) => setDraft(current => ({ ...current, [key]: value }))
  const [authUrl, setAuthUrl] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [newGeminiKey, setNewGeminiKey] = useState('')
  async function testAuth() { try { const value = await api.test_site_authentication(authUrl); setAuthMessage(`Connected: ${value.title}`) } catch (error) { setAuthMessage(errorText(error)) } }
  async function addGeminiKey() { try { setGeminiKeys(await api.add_gemini_key(newGeminiKey)); setNewGeminiKey('') } catch (error) { setAuthMessage(errorText(error)) } }
  async function removeGeminiKey(id) { setGeminiKeys(await api.remove_gemini_key(id)) }
  return <><PageHeader title="Settings" subtitle="Performance, browser connection, AI, and appearance"/><div className="settings-columns">
    <Card><h2>{t('Download performance')}</h2><label>{t('Download folder')}<div className="input-action"><input value={draft.saveLocation || ''} onChange={event => set('saveLocation', event.target.value)} placeholder={t('Choose or paste download folder')}/><Button icon={FolderOpen} onClick={browse}>Browse</Button></div></label><label>{t('Converted files folder')}<div className="input-action"><input value={draft.conversionLocation || ''} onChange={event => set('conversionLocation', event.target.value)} placeholder={t('Choose or paste converted files folder')}/><Button icon={FolderOpen} onClick={browseConversion}>Browse</Button></div></label><div className="field-grid"><label>{t('Parallel downloads')}<select value={draft.parallelDownloads} onChange={event => set('parallelDownloads', Number(event.target.value))}>{[1,2,3,4].map(value => <option key={value}>{value}</option>)}</select></label><label>{t('Fragments per download')}<select value={draft.concurrentFragments} onChange={event => set('concurrentFragments', Number(event.target.value))}>{[1,2,4,8,16].map(value => <option key={value}>{value}</option>)}</select></label></div><p className="hint">{t('Download and converted files can use different folders. Choose both locations before saving settings.')}</p><label>{t('Filename template')}<input value={draft.filenameTemplate} onChange={event => set('filenameTemplate', event.target.value)}/></label><label className="check-label"><input type="checkbox" checked={draft.preventDuplicates} onChange={event => set('preventDuplicates', event.target.checked)}/> {t('Prevent duplicate downloads')}</label></Card>
    <Card><h2>{t('Site authentication')}</h2><p className="hint">{t('Facebook, TikTok, Douyin, and authorized SharePoint links may need cookies from a browser where you are signed in. Close that browser first if its cookie database is locked. Owner-blocked downloads remain unavailable.')}</p><label>{t('Use browser cookies')}<select value={draft.browserCookies} onChange={event => set('browserCookies', event.target.value)}>{['None','Chrome','Edge','Firefox','Brave','Opera','Vivaldi','Chromium'].map(value => <option key={value}>{value}</option>)}</select></label><h2 className="section-gap">{t('Appearance')}</h2><div className="segmented">{['Light','Dark','Liquid Glass','System'].map(value => <button key={value} className={draft.theme === value ? 'selected' : ''} onClick={() => { set('theme', value); setTheme(value) }}>{value === 'Dark' ? <Moon/> : value === 'Liquid Glass' ? <Sparkles/> : <Sun/>}{t(value)}</button>)}</div></Card>
    <Card className="wide-card update-card"><div className="card-title"><div><span className="section-icon cyan"><RefreshCw className={updateStatus?.status === 'checking' ? 'spin' : ''}/></span><h2>{t('Application updates')}</h2><p>{t('Automatically checks verified releases from GitHub and restarts after installation.')}</p></div><span className={`connection-pill ${updateStatus?.status === 'current' ? 'online' : ''}`}>Version {updateStatus?.currentVersion || '—'}</span></div><div className="update-layout"><div><strong>{updateStatus?.available ? `Version ${updateStatus.latestVersion} available` : updateStatus?.status === 'current' ? t('You have the latest version') : t('Release update service')}</strong><p className={updateStatus?.status === 'error' ? 'connection-error' : 'hint'}>{updateStatus?.message}</p>{['downloading','installing'].includes(updateStatus?.status) && <div className="update-progress"><span style={{ width: `${updateStatus.progress || 0}%` }}/></div>}</div><div className="button-row"><Button icon={RefreshCw} onClick={checkUpdate} disabled={['checking','downloading','installing'].includes(updateStatus?.status)}>{updateStatus?.status === 'checking' ? t('Checking…') : t('Check for updates')}</Button>{updateStatus?.available && <Button icon={Download} variant="primary" onClick={installUpdate} disabled={['downloading','installing'].includes(updateStatus?.status)}>{updateStatus?.status === 'downloading' ? `Downloading ${Math.round(updateStatus.progress || 0)}%` : updateStatus?.status === 'installing' ? 'Restarting…' : `Install ${updateStatus.latestVersion}`}</Button>}</div></div></Card>
    <Card className="wide-card extension-card"><div className="card-title"><div><span className="section-icon cyan"><Cable/></span><h2>{t('Browser extension')}</h2><p>{t('Authenticated local connection for the YouTube, TikTok, Facebook, and web video button.')}</p></div><span className={`connection-pill ${extensionConnection?.connected ? 'online' : ''}`}><Wifi/>{extensionConnection?.connected ? t('Connected') : t('Not tested')}</span></div><div className="extension-grid"><label>{t('Local endpoint')}<input value="http://127.0.0.1:38473" readOnly/></label><label>{t('Connection token')}<div className="input-action"><input value={draft.apiToken} readOnly/><Button icon={Copy} onClick={() => navigator.clipboard.writeText(draft.apiToken)}>Copy</Button></div></label><div className="button-row"><Button icon={Wifi} variant="success" onClick={testExtension}>Test connection</Button><Button icon={UploadCloud} onClick={() => api.export_browser_extension()}>Export extension</Button></div></div>{extensionConnection?.error && <p className="connection-error">{extensionConnection.error}</p>}</Card>
    <Card className="wide-card ai-settings-card">
      <div className="card-title"><div><span className="section-icon purple"><BrainCircuit/></span><h2>{t('AI provider and model')}</h2><p>{t('Choose your preferred AI intelligence engine. Supports Google Gemini, Groq Cloud, OpenRouter, CodeCraft, and Inception Labs.')}</p></div><ShieldCheck/></div>
      <div className="provider-switch multi-providers">
        <button className={draft.aiProvider === 'Gemini' ? 'selected' : ''} onClick={() => set('aiProvider', 'Gemini')}><img src="./platforms/gemini.svg" alt=""/>Google Gemini</button>
        <button className={draft.aiProvider === 'Groq' ? 'selected' : ''} onClick={() => set('aiProvider', 'Groq')}><Zap size={15}/>Groq Cloud (7K Free/d)</button>
        <button className={draft.aiProvider === 'OpenRouter' ? 'selected' : ''} onClick={() => set('aiProvider', 'OpenRouter')}><Layers size={15}/>OpenRouter (Free)</button>
        <button className={draft.aiProvider === 'CodeCraft' ? 'selected' : ''} onClick={() => set('aiProvider', 'CodeCraft')}><Sparkles size={15}/>CodeCraft (1M Free)</button>
        <button className={draft.aiProvider === 'InceptionLabs' ? 'selected' : ''} onClick={() => set('aiProvider', 'InceptionLabs')}><Cpu size={15}/>Inception Labs</button>
        <button className={draft.aiProvider === 'Custom' ? 'selected' : ''} onClick={() => set('aiProvider', 'Custom')}><Server size={15}/>Custom API</button>
        <button className={draft.aiProvider === 'Florence-2' ? 'selected' : ''} onClick={() => set('aiProvider', 'Florence-2')}><MonitorUp size={15}/>Local Florence-2</button>
      </div>
      {draft.aiProvider === 'Groq' && (
        <div className="codecraft-key-manager">
          <div className="codecraft-banner groq-banner">
            <Zap size={18} className="groq-icon"/>
            <div className="codecraft-copy">
              <strong>7,000 Free Daily Requests • Ultra-Fast Inference • Meta Llama 3.2 Vision</strong>
              <p>Groq runs Llama 3.2 11B/90B Vision and Llama 3.3 70B at 300+ tokens/sec. Ideal for reverse-engineering thumbnail prompts and instant chat.</p>
            </div>
            <button type="button" className="codecraft-signup-btn groq-signup-btn" onClick={() => (api?.open_external_url ? api.open_external_url('https://console.groq.com/keys') : window.open('https://console.groq.com/keys', '_blank'))}>
              <ExternalLink size={13}/> Get Free Key
            </button>
          </div>
          <div className="ai-fields codecraft-grid">
            <label>
              Groq API Key
              <input
                type="password"
                placeholder={draft.hasGroqApiKey ? 'Key saved securely •••••••• (paste to update)' : 'Paste Groq key (starts with gsk_)'}
                value={draft.groqApiKey || ''}
                onChange={event => set('groqApiKey', event.target.value)}
              />
            </label>
            <label>
              Groq Model
              <select value={draft.groqModel || 'llama-3.2-11b-vision-preview'} onChange={event => set('groqModel', event.target.value)}>
                <option value={draft.groqModel || 'llama-3.2-11b-vision-preview'}>{draft.groqModel || 'llama-3.2-11b-vision-preview'}</option>
                {models.filter(value => value !== (draft.groqModel || 'llama-3.2-11b-vision-preview')).map(value => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="hint">Encrypted with Windows DPAPI. Free tier gives 7,000 requests/day with full Llama 3.2 Vision support.</p>
        </div>
      )}
      {draft.aiProvider === 'OpenRouter' && (
        <div className="codecraft-key-manager">
          <div className="codecraft-banner openrouter-banner">
            <Layers size={18} className="openrouter-icon"/>
            <div className="codecraft-copy">
              <strong>Free Multimodal & Open Models • Universal AI Gateway</strong>
              <p>Access free-tier Vision (Llama 3.2 11B Vision, Gemini 2.0 Flash) and DeepSeek R1 reasoning models without credit card.</p>
            </div>
            <button type="button" className="codecraft-signup-btn openrouter-signup-btn" onClick={() => (api?.open_external_url ? api.open_external_url('https://openrouter.ai/keys') : window.open('https://openrouter.ai/keys', '_blank'))}>
              <ExternalLink size={13}/> Get Free Key
            </button>
          </div>
          <div className="ai-fields codecraft-grid">
            <label>
              OpenRouter API Key
              <input
                type="password"
                placeholder={draft.hasOpenrouterApiKey ? 'Key saved securely •••••••• (paste to update)' : 'Paste OpenRouter key (starts with sk-or-v1-)'}
                value={draft.openrouterApiKey || ''}
                onChange={event => set('openrouterApiKey', event.target.value)}
              />
            </label>
            <label>
              OpenRouter Model
              <select value={draft.openrouterModel || 'meta-llama/llama-3.2-11b-vision-instruct:free'} onChange={event => set('openrouterModel', event.target.value)}>
                <option value={draft.openrouterModel || 'meta-llama/llama-3.2-11b-vision-instruct:free'}>{draft.openrouterModel || 'meta-llama/llama-3.2-11b-vision-instruct:free'}</option>
                {models.filter(value => value !== (draft.openrouterModel || 'meta-llama/llama-3.2-11b-vision-instruct:free')).map(value => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="hint">Encrypted with Windows DPAPI. Select any model ending with <code>:free</code> for unlimited 0-cost usage.</p>
        </div>
      )}
      {draft.aiProvider === 'InceptionLabs' && (
        <div className="codecraft-key-manager">
          <div className="codecraft-banner inception-banner">
            <Cpu size={18} className="inception-icon"/>
            <div className="codecraft-copy">
              <strong>Inception Labs • Mercury Diffusion LLM (260K Context)</strong>
              <p>State-of-the-art diffusion language models (dLLMs) featuring Mercury 2.5 and Mercury 2 with high-speed reasoning and deep context.</p>
            </div>
            <button type="button" className="codecraft-signup-btn inception-signup-btn" onClick={() => (api?.open_external_url ? api.open_external_url('https://inceptionlabs.ai') : window.open('https://inceptionlabs.ai', '_blank'))}>
              <ExternalLink size={13}/> Inception Labs
            </button>
          </div>
          <div className="ai-fields codecraft-grid">
            <label>
              Inception Labs API Key
              <input
                type="password"
                placeholder={draft.hasInceptionApiKey ? 'Key saved securely •••••••• (paste to update)' : 'Paste Inception Labs API key'}
                value={draft.inceptionApiKey || ''}
                onChange={event => set('inceptionApiKey', event.target.value)}
              />
            </label>
            <label>
              Inception Model
              <select value={draft.inceptionModel || 'mercury-2.5'} onChange={event => set('inceptionModel', event.target.value)}>
                <option value={draft.inceptionModel || 'mercury-2.5'}>{draft.inceptionModel || 'mercury-2.5'}</option>
                {models.filter(value => value !== (draft.inceptionModel || 'mercury-2.5')).map(value => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="hint">Encrypted with Windows DPAPI. Connects to https://api.inceptionlabs.ai/v1 with native Mercury 2.5 and Mercury 2 support.</p>
        </div>
      )}
      {draft.aiProvider === 'CodeCraft' && (
        <div className="codecraft-key-manager">
          <div className="codecraft-banner">
            <Sparkles size={18} className="codecraft-sparkle"/>
            <div className="codecraft-copy">
              <strong>1,000,000 Free Monthly Tokens • 33 Models Supported</strong>
              <p>CodeCraft API provides an OpenAI-compatible API without credit card required. Fast drop-in replacement for Gemini.</p>
            </div>
            <button type="button" className="codecraft-signup-btn" onClick={() => (api?.open_external_url ? api.open_external_url('https://codecraftapi.com/register') : window.open('https://codecraftapi.com/register', '_blank'))}>
              <ExternalLink size={13}/> Get Free Key
            </button>
          </div>
          <div className="ai-fields codecraft-grid">
            <label>
              CodeCraft API Key
              <input
                type="password"
                placeholder={draft.hasCodecraftApiKey ? 'Key saved securely •••••••• (paste to update)' : 'Paste CodeCraft key (starts with cc_)'}
                value={draft.codecraftApiKey || ''}
                onChange={event => set('codecraftApiKey', event.target.value)}
              />
            </label>
            <label>
              CodeCraft Model
              <select value={draft.codecraftModel || 'claude-opus-4.8'} onChange={event => set('codecraftModel', event.target.value)}>
                <option value={draft.codecraftModel || 'claude-opus-4.8'}>{draft.codecraftModel || 'claude-opus-4.8'}</option>
                {models.filter(value => value !== (draft.codecraftModel || 'claude-opus-4.8')).map(value => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="hint">Encrypted with Windows DPAPI. Access 33 top models (Claude 3.5/Opus, GPT-4o, DeepSeek, Gemini).</p>
        </div>
      )}
      {draft.aiProvider === 'Custom' && <div className="ai-fields"><label>{t('API base URL')}<input value={draft.customApiBase} placeholder="https://api.openai.com/v1" onChange={event => set('customApiBase', event.target.value)}/></label><label>{t('API key (optional for local APIs)')}<input type="password" placeholder={draft.hasCustomApiKey ? 'Key saved securely ••••••••' : 'Paste API key if required'} onChange={event => set('customApiKey', event.target.value)}/></label><label>{t('Model')}<select value={draft.customApiModel} onChange={event => set('customApiModel', event.target.value)}><option value={draft.customApiModel}>{draft.customApiModel || t('Load available models')}</option>{models.filter(value => value !== draft.customApiModel).map(value => <option key={value}>{value}</option>)}</select></label></div>}
      {draft.aiProvider === 'Gemini' && <div className="gemini-key-manager"><div className="gemini-key-add"><label>{t('Add Gemini API key')} ({geminiKeys.length}/10)<input type="password" value={newGeminiKey} placeholder="Paste a key from another Google account" onChange={event => setNewGeminiKey(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addGeminiKey() }}/></label><Button icon={Plus} variant="primary" onClick={addGeminiKey} disabled={!newGeminiKey.trim() || geminiKeys.length >= 10}>{t('Add key')}</Button></div><div className="gemini-key-list">{geminiKeys.map(item => <div key={item.id}><KeyRound/><span><strong>{item.label}</strong><small>{item.masked}</small></span><IconButton title={t('Remove key')} className="danger-text" onClick={() => removeGeminiKey(item.id)}><Trash2/></IconButton></div>)}</div><label>{t('Gemini model')}<select value={draft.geminiModel} onChange={event => set('geminiModel', event.target.value)}><option value={draft.geminiModel}>{draft.geminiModel}</option>{models.filter(value => value !== draft.geminiModel).map(value => <option key={value}>{value}</option>)}</select></label><p className="hint">{t('Keys are encrypted for this Windows account. Quota and authentication failures rotate keys; temporary model overload automatically falls back to a compatible Gemini Flash model.')}</p></div>}
      {draft.aiProvider === 'Florence-2' && <div className="local-ai-panel"><MonitorUp/><div><strong>{t('Private thumbnail understanding')}</strong><p>{localAiStatus}</p><small>{t('The quantized model is cached on first use. Florence-2 creates thumbnail prompts locally; chat and whole-video requests fall back to Gemini or Custom API.')}</small></div></div>}
      <label className="check-label ai-fallback"><input type="checkbox" checked={draft.aiFallback !== false} onChange={event => set('aiFallback', event.target.checked)}/> {t('Automatically try another configured provider when the default fails')}</label>
      <div className="connection-row"><Button icon={UploadCloud} onClick={loadModels} disabled={busy}>{busy ? t('Connecting…') : draft.aiProvider === 'Florence-2' ? t('Check local model') : t('Test & load models')}</Button>{aiConnection && <span className={`connection-message ${aiConnection.connected ? 'online' : 'error'}`}>{aiConnection.connected ? <Check/> : <X/>}{aiConnection.message}</span>}</div>
    </Card>
    <Card className="wide-card"><div className="card-title"><div><span className="section-icon orange"><Captions/></span><h2>{t('Download enhancements')}</h2><p>{t('Apply subtitles, SponsorBlock segments, or chapter splitting to new jobs.')}</p></div></div><div className="enhancement-grid"><label>{t('Subtitle language')}<input value={draft.subtitleLanguage || ''} onChange={event => set('subtitleLanguage', event.target.value)} placeholder="en or en.*,km"/></label><label className="check-label"><input type="checkbox" checked={Boolean(draft.embedSubtitles)} onChange={event => set('embedSubtitles', event.target.checked)}/> {t('Embed subtitles')}</label><label className="check-label"><input type="checkbox" checked={Boolean(draft.sponsorBlock)} onChange={event => set('sponsorBlock', event.target.checked)}/> {t('Remove SponsorBlock segments')}</label><label className="check-label"><input type="checkbox" checked={Boolean(draft.splitChapters)} onChange={event => set('splitChapters', event.target.checked)}/> {t('Split files by chapters')}</label></div></Card>
    <Card className="wide-card"><div className="card-title"><div><span className="section-icon cyan"><KeyRound/></span><h2>{t('Authentication test')}</h2><p>{t('Verify that the selected browser session can access Facebook, TikTok, Douyin, SharePoint, or another signed-in video.')}</p></div></div><div className="input-action"><input value={authUrl} onChange={event => setAuthUrl(event.target.value)} placeholder={t('Paste a signed-in video URL')}/><Button icon={Wifi} onClick={testAuth}>{t('Test access')}</Button></div>{authMessage && <p className="hint">{authMessage}</p>}</Card>
  </div><Button icon={Check} variant="primary" className="save-settings" onClick={save}>{t('Save settings')}</Button></>
}

function AiPage({ messages, input, setInput, video, setVideo, send, useCurrent, grounded, setGrounded }) {
  const t = useContext(I18nContext)
  return <><PageHeader title="AI assistant" subtitle="Realtime conversation with optional transcript-grounded answers"/><div className="ai-layout"><Card className="chat-card"><div className="video-context"><label>{t('Video context')}<div className="input-action"><input value={video} onChange={event => setVideo(event.target.value)} placeholder={t('Attach a public video URL')}/><Button icon={Play} onClick={useCurrent}>{t('Use current')}</Button></div></label><label className="check-label grounded-toggle"><input type="checkbox" checked={grounded} onChange={event => setGrounded(event.target.checked)}/> {t('Ground answers in the video transcript and cite timestamps')}</label></div><div className="messages">{messages.map((message, index) => <div key={index} className={`message ${message.role === 'You' ? 'user' : ''}`}><div>{message.role === 'You' ? 'You' : <><Sparkles size={14}/> CPS AI</>}</div><p>{message.text}</p>{message.role !== 'You' && message.text !== 'Thinking…' && <button onClick={() => navigator.clipboard.writeText(message.text)}><Copy size={14}/> {t('Copy')}</button>}</div>)}</div><div className="composer"><textarea value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send() } }} placeholder={t('Ask about the video, request a script, title ideas, or thumbnail prompt…')}/><Button icon={Send} variant="primary" onClick={send}>{t('Send')}</Button></div></Card><div className="ai-tools"><Card><WandSparkles size={26}/><h2>{t('Creative workflows')}</h2><button onClick={() => setInput('Create a detailed thumbnail image prompt for this video.')}><Sparkles/> {t('Thumbnail prompt')}</button><button onClick={() => setInput('Summarize this video with its main meaning and key takeaways.')}><MessageCircle/> {t('Video summary')}</button><button onClick={() => setInput('Deeply analyze this video chronologically and capture all important details.')}><Search/> {t('Deep analysis')}</button><button onClick={() => setInput('Create a complete video script inspired by this idea.')}><FileVideo/> {t('Script writer')}</button></Card></div></div></>
}

function AboutPage({ boot, api }) {
  const t = useContext(I18nContext)
  const openUrl = (url) => {
    if (api?.open_external_url) {
      api.open_external_url(url)
    } else {
      window.open(url, '_blank')
    }
  }

  return <>
    <PageHeader title="About" subtitle="Free, open source, and privacy-focused media workspace"/>
    <div className="about-pro-layout">
      <Card className="about-hero-card">
        <div className="about-hero-badge">
          <ShieldCheck size={14}/>
          <span>{t('100% Free & Open Source • MIT License')}</span>
        </div>
        <div className="about-brand-header">
          <div className="logo-mark pro-glow"><Download size={44}/></div>
          <div className="about-brand-titles">
            <h1>CPS Universal Downloader Premium</h1>
            <div className="about-version-row">
              <span className="version-tag">{t('Version')} {boot.version}</span>
              <span className="status-indicator-tag"><span className="online-dot"/> {t('Active Engine')}</span>
            </div>
          </div>
        </div>
        <p className="about-lead">
          {t('A lightning-fast, privacy-first desktop workspace to download media from YouTube, TikTok, Facebook, Douyin, SharePoint, and 1,000+ platforms. Features native FFmpeg media conversion, multi-provider AI assistance (Groq Cloud, OpenRouter, CodeCraft, Inception Labs, Google Gemini), and zero tracking.')}
        </p>

        <div className="pro-feature-cards">
          <div className="pro-feature-item">
            <div className="feature-icon-bubble cyan"><Zap size={20}/></div>
            <strong>{t('Turbo Concurrent Engine')}</strong>
            <p>{t('Resumable multi-threaded fragments, 64K buffer, and intelligent quality fallback.')}</p>
          </div>
          <div className="pro-feature-item">
            <div className="feature-icon-bubble purple"><RotateCcw size={20}/></div>
            <strong>{t('Native Media Converter')}</strong>
            <p>{t('Lossless FFmpeg conversion for MP4, MKV, MP3, WAV, FLAC, HEIC, and GIFs.')}</p>
          </div>
          <div className="pro-feature-item">
            <div className="feature-icon-bubble orange"><BrainCircuit size={20}/></div>
            <strong>{t('Multi-Provider AI Intelligence')}</strong>
            <p>{t('Groq (7K free/d), OpenRouter (Free Vision), Inception Labs (Mercury dLLM), CodeCraft (1M/mo), and Google Gemini.')}</p>
          </div>
          <div className="pro-feature-item">
            <div className="feature-icon-bubble green"><ShieldCheck size={20}/></div>
            <strong>{t('Private & Secure')}</strong>
            <p>{t('Zero telemetry. All keys encrypted with Windows DPAPI. Runs completely offline.')}</p>
          </div>
        </div>
      </Card>

      <div className="about-two-columns">
        <Card className="pro-github-card">
          <div className="github-card-header">
            <GitHubIcon size={34} className="github-logo-svg"/>
            <div>
              <h2>{t('GitHub Open Source Project')}</h2>
              <span className="repo-slug">Chuobpiseth/cps-universal-downlaoder</span>
            </div>
          </div>
          <p className="github-card-description">
            {t('This project is open-source under the MIT license. You can inspect the complete source code, download portable builds, submit feature suggestions, or contribute improvements.')}
          </p>
          <div className="github-action-buttons">
            <Button icon={ExternalLink} variant="primary" onClick={() => openUrl('https://github.com/Chuobpiseth/cps-universal-downlaoder')}>
              <GitHubIcon size={16}/> <span>{t('View Repository')}</span>
            </Button>
            <Button icon={ExternalLink} onClick={() => openUrl('https://github.com/Chuobpiseth/cps-universal-downlaoder/releases')}>
              {t('Releases & Notes')}
            </Button>
          </div>
        </Card>

        <Card className="pro-donation-card">
          <div className="donation-card-header">
            <div className="coffee-bubble"><Coffee size={24}/></div>
            <div>
              <h2>{t('Support Our Work • Buy Me a Coffee')}</h2>
              <p className="donation-subtitle">{t('100% Free Software • Community Supported')}</p>
            </div>
          </div>
          <p className="donation-text">
            {t('CPS Universal Downloader is free for everyone. If it saves you time and effort, you can support our ongoing development and buy me a coffee via ABA KHQR:')}
          </p>
          <div className="khqr-card-wrapper">
            <div className="khqr-paper">
              <div className="khqr-top-bar">
                <span className="khqr-pill">KHQR</span>
                <strong>Chuob Piseth</strong>
              </div>
              <img src="./assets/aba.png" alt="Donate via ABA KHQR" className="khqr-image" onError={e => { e.currentTarget.style.display = 'none' }}/>
              <div className="khqr-footer-bar">
                <span>{t('Scan with ABA Mobile, Bakong, or any bank app')}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="about-footer-legal">
        <strong className="made-by-text">© 2026 CPS Universal Downloader Premium • {t('Made by Chuob Piseth')}</strong>
        <p className="disclaimer-text">{t('Download and convert only content that you own or have permission to use.')}</p>
      </div>
    </div>
  </>
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>)
