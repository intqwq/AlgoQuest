import { readFile, writeFile, rm, mkdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const generatedFiles = {"services/api/src/oj.mjs":"aW1wb3J0IHsKICBFZGl0b3JpYWxDb250ZW50RXJyb3IsCiAgZWRpdG9yaWFsQ29udGVudEZvcm1hdHMsCiAgdmFsaWRhdGVFZGl0b3JpYWxDb250ZW50LAp9IGZyb20gIi4vZWRpdG9yaWFsLWNvbnRlbnQubWpzIjsKCmNvbnN0IGdyb3VwcyA9IFsKICBbImxhbmd1YWdlIiwgeyBlbjogIkxhbmd1YWdlICYgZm91bmRhdGlvbnMiLCAiemgtQ04iOiAi6K+t6KiA5LiO5Z+656GAIiwgamE6ICLogIDoqp7jgajln7rnpI4iIH0sIFsKICAgICLpoo/luo/nu5PmnoQiLCAi5YiG5pSv57uT5p6EIiwgIuW+queOr+e7k+aehCIsICLmlbDnu4QiLCAi5a2X56ym5LiyIiwgIuWHveaVsCIsICLpgJLlvZIiLCAi57uT5p6E5L2TIiwgIuaMh+eSiSIsICJTVEwiLCAi5aSN5p2C5bqm5YiG5p6QIiwgIklPIOS8mOWMliIsCiAgXV0sCiAgWyJ0ZWNobmlxdWVzIiwgeyBlbjogIkdlbmVyYWwgdGVjaG5pcXVlcyIsICJ6aC1DTiI6ICLln7rnoYDnrpfms5UiLCBqYTogIuWfuuacrOODhuOCr+ODi+ODg+OCryIgfSwgWwogICAgIuaooeaLn+S4uyIsICLkuL7kvosiLCAi5p6E6YCgIiwgIkFkLWhvYyIsICLmj5LlpLQgRFAiLCAi5o6S5YiXIiwgIuS6jOWIhiIsICLkuInliIYiLCAi5YiG5rK7IiwgIuWAn+WinuS4kSIsICLliY3nuYDlkokiLCAi5beu5YiGIiwgIueptuaVoyIsICLlj4zmkIfpkIgiLCAi5ruR5Yqo56qX5Y+jIiwgIk1lZXQtaW4tdGhlLW1pZGRsZSIsICLpmY/æœº5YyWIiwgIuWQr+WPkee7k+aehCIsICLlt6XlhbfkuJYiLCAi6LSq5b+D4oCdLAogIF1dLAogIFsic2VhcmNoIiwgeyBlbjogIlNlYXJjaCIsICJ6aC1DTiI6ICLmkJzntKIiLCBqYTogIuaOoue0oiIgfSwgWwogICAgIuaQnOe0oiIsICLmt7Hlup/kvJjlhYjmkJzntKIgREZTIiwgIuW5v+W6puS8mOWFiOaQnOe0oiBCRlMiLCAi6L+N5Luj5Yqg5rexIiwgIuWPjOeOsuaQnOe0oiIsICJBKiIsICJJREEqIiwgIuWJquaUrSIsICLorrDlv4bljJbmkJzntKIiLCAi5Zue5rqvIiwgIuiInui5j+iTneWvueebiCIsCiAgXV0sCiAgWyJkcCIsIHsgZW46ICJEeW5hbWljIHByb2dyYW1taW5nIiwgInpoLUNOIjogIuWKqOaAgeinhOWIkiIsIGphOiAi5YuV55qE6KiI55S75rOVIiB9LCBbCiAgICAi5Yqo5oCB6KeE5YiSIERQIiwgIue6v+aAp0RQIiwgIuiDjOWMheWKoOa3sSBEUCIsICLljLrpm7QgRFAiLCAi5qCR5b2iIERQIiwgIuaVsOS9jSBEUCIsICLnirbmgIHljovnvKkgRFAiLCAi5qaC546HIERQIiwgIuiuoeaVsCBEUCIsICLmj5LlpLQgRFAiLCAi6L2u5buT57q/IERQIiwgIuaWn+eOh+S8mOWMliBEUCIsICLlm5vovrnlvaLkuI3nrYnlvI/kvJjljJYiLCAi5Yaz562W5Y2V6LCD5oCnIiwgIuWKqOaAgeWKoOa3sSIsCiAgXV0sCiAgWyJzdHJ1Y3R1cmVzIiwgeyBlbjogIkRhdGEgc3RydWN0dXJlcyIsICJ6aC1DTiI6ICLmlbDmja7nu5PmnoQiLCBqYTogIuODh+ODvOOCv+aopumAoCIgfSwgWwogICAgIuagiCIsICLpmJ/liJciLCAi5Y2V6LCD5qCIiLCAi5Y2V6LCDpmJ/liJciLCAi5aCGIiwgIuWTiOW4jOihqCIsICLpk77ooagiLCAi5bm25p+l6ZuGIiwgIuagkeeKtuaVsOe7hCIsICLnur/mrrXmoJEiLCAi57q/5q615qCR5ZCI5bm2IiwgIuadjui2hee6v+auteagkSIsICJTVCDooagiLCAi56iA55aP6KGoIiwgIuWIhuWdlyIsICLojqvpmJ8iLCAi5bim5L+u6I6r6ZifIiwgIuagkeS4iuiOq+mYnyIsICLlm57mu5rojqvpmJ8iLCAi5Y+v5oyB5LmF5YyW5pWw5o2u57uT5p6EIiwgIuWPr+aMgeS5heWMlue6v+auteagkSIsICLkuLvluK3moJEiLCAi5bmz6KGh5qCRIiwgIlRyZWFwIiwgIkZIUSBUcmVhcCIsICJTcGxheSIsICLmm7/nvarnvormoJEiLCAiSy1EIFRyZWUiLCAi5Yqo5oCB5qCRIExDVCIsICLmoJHlpZfmoJEiLCAi5bem5YGP5qCRIiwgIuagkeWghiIsICLnrJvljaHlsJTmoJEiLCAi5bCP5rOi55+p6Zi1IiwgIuWPr+aMgeeUqOW5tuaVsOaNruW6k+e7k+aehCIsICLlj4zov5rpgJrliIbph48iLCAi5bCR5rOi55+p6Zi1IiwgIuWPr+W3ruS9s+W5tuaVsOaNruW6k+e7k+aehCIsCiAgXV0sCiAgWyJncmFwaCIsIHsgZW46ICJHcmFwaHMgJiBmbG93cyIsICJ6aC1DTiI6ICLlm77orrrkuI7nvZHnu5zmtYEiLCBqYTogIuOCsOODqeODleODu+ODleODreODvCIgfSwgWwogICAgIuWbvueahCIsICLlm77nmoTpgY3ljosiLCAi5ouT5omR5o6S5bqPIiwgIuacgOefrei3ryIsICJEaWprc3RyYSIsICJCZWxsbWFuLUZvcmQiLCAiU1BGQSIsICJGbG95ZCIsICLnlJ/miJDmoJEiLCAi5pyA5bCP55Sf5oiQ5qCRIiwgIktydXNrYWwiLCAiUHJpbSIsICLlvLfooYzov57pgJrliIbln70iLCAi5Y+M6L+e6YCa5YiG6YePIiwgIuWJjeeCueS4muS4sSIsICLmoaUiLCAiMi1TQVQiLCAi5qyn5ouJ6Lev5b6EIiwgIuWTiOWvhOW4p+i3r+W+hCIsICLlt67liIbmna/nurEiLCAi5Z+6562W5qCRIiwgIuS7meS6uuS4m+mrmCIsICLnvZHnu5zmtYEiLCAi5pyA5aSn5rWBIiwgIuacgOWwj+WJsiIsICLotLnnlKjmtYEiLCAi5LiK5LiL55WM572R57uc5rWBIiwgIuS6jOWIhuWbviIsICLkuozliIblm77ljLnpkY0iLCAi5Yy55YyF5Yip5Lqa566X5rOVIiwgIktNIOeul+azlSIsICJIYWxsIOWumueQhiIsICLmlK/ljYfmoJEiLAogIF1dLAogIFsidHJlZSIsIHsgZW46ICJUcmVlcyIsICJ6aC1DTiI6ICLmoJHorrogIiwgamE6ICLmnKjmp4vpgKAiIH0sIFsKICAgICLmoJHorrogIiwgIuagkeeahOebtOW+hCIsICLmoJHnmoTph43lv4MiLCAi5pyA6L+R5YWs5YWx56WW5YWI IExDQSIsICLmoJHpl77liYXmlrwiLCAi5qCR5LiK5beu5YiGIiwgIuagkeS4iuWAn+WinuS4kSIsICLmoJHkuIrlkK/lj5HlvI/å�ˆå¹¶IiwgIkRTVSBvbiBUcmVlIiwgIuiZm+agkSIsICLngrnliIbmsrsiLCAi6L655YiG5rK7IiwgIumVv+i/n+WJliIsICJQcnVmZXIg5bqP5YiXIiwKICBdXSwKICBbInN0cmluZyIsIHsgZW46ICJTdHJpbmdzIiwgInpoLUNOIjogIuWtl+espuS4siIsIGphOiAi5paH5a2X5YiXIiB9LCBbCiAgICAi5a2X56ym5Liy566X5rOVIiwgIuWtl+espuS4suWTiOW4jCIsICJUcmllIiwgIuWtl+WFu+agkSIsICJLTVAiLCAiWiDlh73mlbAiLCAiTWFuYWNoZXIiLCAiQUMg6Ieq5Yqo5py6IiwgIuWQjue8gOaVsOe7hCBTQSIsICLlkI7nvIDoh6rliqjmnLogU0FNIiwgIuWQjue8gOagkSIsICLlm57mlofoh6rliqjmnLogUEFNIiwgIuacgOWwj+ihqOekuuazlSIsICJMeW5kb24g5YiG6KejIiwgIuWQjue8gOW5s+ihoeagkSIsCiAgXV0sCiAgWyJtYXRoIiwgeyBlbjogIk1hdGhlbWF0aWNzIiwgInpoLUNOIjogIuaVsOWtpuS4juaVsOiuuiIsIGphOiAi5pWw5a2m44O756eH6K66IiB9LCBbCiAgICAi5pWw5a2mIiwgIumrmOeyvuW6piIsICLov5vliLYiLCAi5b+r6YCf5bmCIiwgIue9q+mYt+W/q+mAn+W5tiIsICLmlbDorroiLCAi6LS555SoIiwgIueulyIsICJNaWxsZXItUmFiaW4iLCAiUG9sbGFyZC1SaG8iLCAi5pyA5aSn5YWs57qm5pWwIiwgIuaLkOWxlOq3mOWHoOS5jOW+lCIsICLlkIzkvZkiLCAi5Lit5Zu95Ymp5L2Z5a6a55CGIENSVCIsICLpgIblhYMiLCAi5qyn5ouJ5Ye95pWwIiwgIuaVsOiuuuS6pOi/sCIsICJCU0dTIiwgIuWOn+agueS4lyIsICLkuozmrKHliKnkvZkiLCAiUGVsbCDmlrnnqIsiLCAi5ouJ6LSd5bCU5YWL5YWI6L+Y5b2VIiwgIkJ1cm5zaWRlIOW8leeQhiIsICJQb2x5YSDlrprnkIYiLAogIF1dLAogIFsicG9seW5vbWlhbCIsIHsgZW46ICJQb2x5bm9taWFsIGFsZ29yaXRobXMiLCAiemgtQ04iOiAi5aSa6aG55byPIiwgamE6ICLlpJrpobnlvI8iIH0sIFsKICAgICLlpJrpobnlvI8iLCAi5b+r6YCf5YKF6YeM5Y+25Y+Y5o2iIEZGVCIsICLmlbDorroiLCAi5b+r6YCf5rKD5bCU5LuA5Y+Y5o2iIEZXVCIsICLlpJrpobnlvI/æ±‚é€†IiwgIuWkmumhueW8j+WvueaVsCIsICLlpJrpobnlvI/æŒ‡æ•°IiwgIuWkmumhueW8j+W8gOagniIsICLmiabnibnmoYnmlrLmj5LlgLwiLCAiQmVybGVrYW1wLU1hc3NleSIsICLnur/mgKfpgJLmj5IiLAogIF1dLAogIFsiZ2VvbWV0cnkiLCB7IGVuOiAiQ29tcHV0YXRpb25hbCBnZW9tZXRyeSIsICJ6aC1DTiI6ICLorqHnrpfkuIDkvZMiLCBqYTogIuioiOeul+WHoOS9lSIgfSwgWwogICAgIuiuoeeul+WHoOS9lSIsICLlkJHph48iLCAi5Y+J56evIiwgIueCueenryIsICLlh7jljIUiLCAi5peL6L2s5Y2h5aOzIiwgIuWNiuW5s+mdouS6pCIsICLmiavmj4/nur8iLCAi5bmz6Z2i5pyA6L+R54K55a+5IiwgIuWchiIsICLmnoHop5LmjpLluo8iLCAi5LiJ57u06K6h566X5Yeg5L2VIiwgIuiHqumAguW6lOi+m+aZruajruazlSIsCiAgXV0sCiAgWyJhZHZhbmNlZCIsIHsgZW46ICJBZHZhbmNlZCAmIHNwZWNpYWwiLCAiemgtQ04iOiAi6L+b6Zi25LiO54m55q6K6aKY5Z6LIiwgamE6ICLkuI3ntJrjg7vnibnmrosiIH0sIFsKICAgICLkuqTkuJbpopgiLCAi6L6T5Ye6562U5qGI6aKYIiwgIuaPkOS6pOetlOahiOmimCIsICJTcGVjaWFsIEp1ZGdlIiwgIk8yIOS8mOWMliIsICLlnKjnur/nrpfms5UiLCAi56a756q/566X5rOVIiwgIuagueWPt+WIhumHjyIsICLmlbTkvZPkuozliIYiLCAiQ0RRIuWIhumHjyIsICLlubPoiYzkuozliIYiLCAi54+25py15Li96aG1IiwgIkZIUSBUcmVhcCIsICLlj4/mkrTplIDå¹¶æŸ¥é›†IiwgIuWwj+azoue9qeW8jyIsICLmlK/é…�æ ‘vCIsICLlkI7nvIDå¹³è¡¡æ ‘IiwKICBdXSwKXTsKCmV4cG9ydCBjb25zdCBvaUFsZ29yaXRobVRhZ0dyb3VwcyA9IE9iamVjdC5mcmVlemUoZ3JvdXBzLm1hcCgoW2lkLCBsYWJlbHMsIHRhZ3NdKSA9PiBPYmplY3QuZnJlZXplKHsKICBpZCwKICBsYWJlbHM6IE9iamVjdC5mcmVlemUobGFiZWxzKSwKICB0YWdzOiBPYmplY3QuZnJlZXplKHRhZ3MpLAp9KSkpOwpleHBvcnQgY29uc3Qgb2lBbGdvcml0aG1UYWdzID0gT2JqZWN0LmZyZWV6ZShbLi4ubmV3IFNldChvaUFsZ29yaXRobVRhZ0dyb3Vwcy5mbGF0TWFwKChncm91cCkgPT4gZ3JvdXAudGFncykpXSk7CmNvbnN0IGFsbG93ZWRUYWdTZXQgPSBuZXcgU2V0KG9pQWxnb3JpdGhtVGFncyk7CgpleHBvcnQgY2xhc3MgT2pWYWxpZGF0aW9uRXJyb3IgZXh0ZW5kcyBFcnJvciB7CiAgY29uc3RydWN0b3IoY29kZSkgewogICAgc3VwZXIoY29kZSk7CiAgICB0aGlzLm5hbWUgPSAiT2pWYWxpZGF0aW9uRXJyb3IiOwogICAgdGhpcy5jb2RlID0gY29kZTsKICB9Cn0KCmZ1bmN0aW9uIHRleHQodmFsdWUsIG1heGltdW0pIHsKICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAic3RyaW5nIgogICAgPyB2YWx1ZS5yZXBsYWNlKC9cdTAwMDAvZywgIiIpLnRyaW0oKS5zbGljZSgwLCBtYXhpbXVtKQogICAgOiAiIjsKfQoKZnVuY3Rpb24gdmFsaWRhdGVTdGF0ZW1lbnQodmFsdWUpIHsKICBpZiAodmFsdWU/LnN0YXRlbWVudEZvcm1hdCAhPT0gZWRpdG9yaWFsQ29udGVudEZvcm1hdHMucmljaCkgewogICAgdGhyb3cgbmV3IE9qVmFsaWRhdGlvbkVycm9yKCJPSl9SSUNIX1NUQVRFTUVOVF9SRVFVSVJFRCIpOwogIH0KICB0cnkgewogICAgcmV0dXJuIHZhbGlkYXRlRWRpdG9yaWFsQ29udGVudCh2YWx1ZS5zdGF0ZW1lbnQsIGVkaXRvcmlhbENvbnRlbnRGb3JtYXRzLnJpY2gpOwogIH0gY2F0Y2ggKGVycm9yKSB7CiAgICBpZiAoZXJyb3IgaW5zdGFuY2VvZiBFZGl0b3JpYWxDb250ZW50RXJyb3IpIHsKICAgICAgdGhyb3cgbmV3IE9qVmFsaWRhdGlvbkVycm9yKGVycm9yLmNvZGUpOwogICAgfQogICAgdGhyb3cgZXJyb3I7CiAgfQp9CgpleHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVP alByb2JsZW0odmFsdWUpIHsKICBpZiAoIXZhbHVlIHx8IHR5cGVvZiB2YWx1ZSAhPT0gIm9iamVjdCIpIHsKICAgIHRocm93IG5ldyBPalZhbGlkYXRpb25FcnJvcigiSU5WQUxJRF9PSl9QUk9CTEVNIik7CiAgfQogIGNvbnN0IHRpdGxlID0gdGV4dCh2YWx1ZS50aXRsZSwgMTYwKTsKICBpZiAodGl0bGUubGVuZ3RoIDwgMykgdGhyb3cgbmV3IE9qVmFsaWRhdGlvbkVycm9yKCJPSl9USVRMRV9SRVFVSVJFRCIpOwogIGNvbnN0IHN0YXRlbWVudCA9IHZhbGlkYXRlU3RhdGVtZW50KHZhbHVlKTsKICBjb25zdCBzdGRTb3VyY2UgPSB0eXBlb2YgdmFsdWUuc3RkU291cmNlID09PSAic3RyaW5nIgogICAgPyB2YWx1ZS5zdGRTb3VyY2UucmVwbGFjZSgvXHUwMDAwL2csICIiKS5zbGljZSgwLCAyNTYgKiAxMDI0KQogICAgOiAiIjsKICBpZiAoIXN0ZFNvdXJjZS50cmltKCkpIHRocm93IG5ldyBPalZhbGlkYXRpb25FcnJvcigiT0pfU1REX1JFUVVJUkVEIik7CgogIGNvbnN0IHRpbWVMaW1pdE1zID0gTWF0aC5yb3VuZChOdW1iZXIodmFsdWUudGltZUxpbWl0TXMpKTsKICBjb25zdCBtZW1vcnlMaW1pdE1iID0gTWF0aC5yb3VuZChOdW1iZXIodmFsdWUubWVtb3J5TGltaXRNYikpOwogIGNvbnN0IGRpZmZpY3VsdHkgPSBNYXRoLnJvdW5kKE51bWJlcih2YWx1ZS5kaWZmaWN1bHR5KSk7CiAgaWYgKCFOdW1iZXIuaXNGaW5pdGUodGltZUxpbWl0TXMpIHx8IHRpbWVMaW1pdE1zIDwgMTAwIHx8IHRpbWVMaW1pdE1zID4gMTBfMDAwKSB7CiAgICB0aHJvdyBuZXcgT2pWYWxpZGF0aW9uRXJyb3IoIklOVkFMSURfT0pfVElNRV9MSU1JVCIpOwogIH0KICBpZiAoIU51bWJlci5pc0Zpbml0ZShtZW1vcnlMaW1pdE1iKSB8fCBtZW1vcnlMaW1pdE1iIDwgMTYgfHwgbWVtb3J5TGltaXRNYiA+IDEwMjQpIHsKICAgIHRocm93IG5ldyBPalZhbGlkYXRpb25FcnJvcigiSU5WQUxJRF9PSl9NRU1PUllfTElNSVQiKTsKICB9CiAgaWYgKCFOdW1iZXIuaXNGaW5pdGUoZGlmZmljdWx0eSkgfHwgZGlmZmljdWx0eSA8IDEgfHwgZGlmZmljdWx0eSA+IDEwKSB7CiAgICB0aHJvdyBuZXcgT2pWYWxpZGF0aW9uRXJyb3IoIklOVkFMSURfT0pfRElGRklDVUxUWSIpOwogIH0KCiAgY29uc3QgdGFncyA9IEFycmF5LmlzQXJyYXkodmFsdWUudGFncykKICAgID8gWy4uLm5ldyBTZXQodmFsdWUudGFncy5tYXAoKHRhZykgPT4gdGV4dCh0YWcsIDgwKSkuZmlsdGVyKEJvb2xlYW4pKV0KICAgIDogW107CiAgaWYgKCF0YWdzLmxlbmd0aCB8fCB0YWdzLmxlbmd0aCA+IDEyIHx8IHRhZ3Muc29tZSgodGFnKSA9PiAhYWxsb3dlZFRhZ1NldC5oYXModGFnKSkpIHsKICAgIHRocm93IG5ldyBPalZhbGlkYXRpb25FcnJvcigiSU5WQUxJRF9PSl9UQUdTIik7CiAgfQoKICBpZiAoIUFycmF5LmlzQXJyYXkodmFsdWUudGVzdHMpIHx8IHZhbHVlLnRlc3RzLmxlbmd0aCA8IDEgfHw gdmFsdWUudGVzdHMubGVuZ3RoID4gNTApIHsKICAgIHRocm93IG5ldyBPalZhbGlkYXRpb25FcnJvcigiSU5WQUxJRF9PSl9URVNUUyIpOwogIH0KICBjb25zdCB0ZXN0cyA9IHZhbHVlLnRlc3RzLm1hcCgodGVzdENhc2UsIGluZGV4KSA9PiB7CiAgICBpZiAoIXRlc3RDYXNlIHx8IHR5cGVvZiB0ZXN0Q2FzZS5pbnB1dCAhPT0gInN0cmluZyIgfHwgdHlwZW9mIHRlc3RDYXNlLmV4cGVjdGVkICE9PSAic3RyaW5nIikgewogICAgICB0aHJvdyBuZXcgT2pWYWxpZGF0aW9uRXJyb3IoIklOVkFMSURfT0pfVEVTVF9DQVNFIik7CiAgICB9CiAgICBpZiAoQnVmZmVyLmJ5dGVMZW5ndGgodGVzdENhc2UuaW5wdXQsICJ1dGY4IikgPiAyNTYgKiAxMDI0IHx8IEJ1ZmZlci5ieXRlTGVuZ3RoKHRlc3RDYXNlLmV4cGVjdGVkLCAidXRmOCIpID4gMjU2ICogMTAyNCkgewogICAgICB0aHJvdyBuZXcgT2pWYWxpZGF0aW9uRXJyb3IoIk9KX1RFU1RfQ0FTRV9UT09fTEFSR0UiKTsKICAgIH0KICAgIHJldHVybiB7CiAgICAgIGlkOiBTdHJpbmcoaW5kZXggKyAxKS5wYWRTdGFydCgyLCAiMCIpLAogICAgICBpbnB1dDogdGVzdENhc2UuaW5wdXQsCiAgICAgIGV4cGVjdGVkOiB0ZXN0Q2FzZS5leHBlY3RlZCwKICAgICAgc2FtcGxlOiB0ZXN0Q2FzZS5zYW1wbGUgPT09IHRydWUsCiAgICB9OwogIH0pOwogIGlmICghdGVzdHMuc29tZSgodGVzdENhc2UpID0+IHRlc3RDYXNlLnNhbXBsZSkpIHsKICAgIHRocm93IG5ldyBPalZhbGlkYXRpb25FcnJvcigiT0pfU0FNUExFX1JFUVVJUkVEIik7CiAgfQoKICByZXR1cm4gewogICAgdGl0bGUsCiAgICBzdGF0ZW1lbnQ6IHN0YXRlbWVudC5jb250ZW50LAogICAgc3RhdGVtZW50Rm9ybWF0OiBzdGF0ZW1lbnQuY29udGVudEZvcm1hdCwKICAgIHRpbWVMaW1pdE1zLAogICAgbWVtb3J5TGltaXRNYiwKICAgIGRpZmZpY3VsdHksCiAgICB0YWdzLAogICAgdGVzdHMsCiAgICBzdGRTb3VyY2UsCiAgfTsKfQoKZXhwb3J0IGZ1bmN0aW9uIHB1YmxpY09qUHJvYmxlbShwcm9ibGVtLCB7IGluY2x1ZGVTdGF0ZW1lbnQgPSB0cnVlIH0gPSB7fSkgewogIHJldHVybiB7CiAgICBpZDogcHJvYmxlbS5pZCwKICAgIHB1YmxpY0lkOiBwcm9ibGVtLnB1YmxpY0lkLAogICAgdGl0bGU6IHByb2JsZW0udGl0bGUsCiAgICAuLi4oaW5jbHVkZVN0YXRlbWVudCA/IHsKICAgICAgc3RhdGVtZW50OiBwcm9ibGVtLnN0YXRlbWVudCwKICAgICAgc3RhdGVtZW50Rm9ybWF0OiBwcm9ibGVtLnN0YXRlbWVudEZvcm1hdCwKICAgIH0gOiB7fSksCiAgICB0aW1lTGltaXRNczogcHJvYmxlbS50aW1lTGltaXRNcywKICAgIG1lbW9yeUxpbWl0TWI6IHByb2JsZW0ubWVtb3J5TGltaXRNYiwKICAgIGRpZmZpY3VsdHk6IHByb2JsZW0uZGlmZmljdWx0eSwKICAgIHRhZ3M6IHByb2JsZW0udGFncywKICAgIGF1dGhvcjogcHJvYmxlbS5hdXRob3IsCiAgICBzdWJtaXNzaW9uQ291bnQ6IHByb2JsZW0uc3VibWlzc2lvbkNvdW50ID8/IDAsCiAgICBhY2NlcHRlZENvdW50OiBwcm9ibGVtLmFjY2VwdGVkQ291bnQgPz8gMCwKICAgIHNhbXBsZXM6IGluY2x1ZGVTdGF0ZW1lbnQKICAgICAgPyBwcm9ibGVtLnRlc3RzLmZpbHRlcigo dGVzdENhc2UpID0+IHRlc3RDYXNlLnNhbXBsZSkubWFwKCh7IGlucHV0LCBleHBlY3RlZCB9KSA9PiAoeyBpbnB1dCwgb3V0cHV0OiBleHBlY3RlZCB9KSkKICAgICAgOiB1bmRlZmluZWQsCiAgICBjcmVhdGVkQXQ6IHByb2JsZW0uY3JlYXRlZEF0LAogICAgcHVibGlzaGVkQXQ6IHByb2JsZW0ucHVibGlzaGVkQXQsCiAgfTsKfQoKZXhwb3J0IGZ1bmN0aW9uIHRydXN0ZWRPalF1ZXN0KHByb2JsZW0pIHsKICByZXR1cm4gewogICAgbGFuZ3VhZ2U6ICJjcHAxNCIsCiAgICB0aW1lTGltaXRNczogcHJvYmxlbS50aW1lTGltaXRNcywKICAgIG1lbW9yeUxpbWl0TWI6IHByb2JsZW0ubWVtb3J5TGltaXRNYiwKICAgIGNvbXBpbGVMaW1pdE1zOiAxNV8wMDAsCiAgICBwYXNzU2NvcmU6IDEwMCwKICAgIHRlc3RzOiBwcm9ibGVtLnRlc3RzLm1hcCgoeyBpZCwgaW5wdXQsIGV4cGVjdGVkIH0pID0+ICh7IGlkLCBpbnB1dCwgZXhwZWN0ZWQgfSkpLAogIH07Cn0K","lib/oj-api.ts":"aW1wb3J0IHsKICBhcGlVcmwsCiAgYXV0aGVudGljYXRlZEZldGNoLAogIEF1dGhBcGlFcnJvciwKICB0eXBlIEVkaXRvcmlhbENvbnRlbnRGb3JtYXQsCiAgdHlwZSBKdWRnZVN1Ym1pc3Npb25TdGF0ZSwKfSBmcm9tICJAL2xpYi9hcGktY2xpZW50IjsKCmV4cG9ydCB0eXBlIE9qUHJvYmxlbVN0YXR1cyA9CiAgfCAicGVuZGluZyIKICB8ICJwdWJsaXNoZWQiCiAgfCAicmVqZWN0ZWQiCiAgfCAiYXJjaGl2ZWQiCiAgfCAiZGVsZXRlZCI7CgpleHBvcnQgdHlwZSBPalRhZ0dyb3VwID0gewogIGlkOiBzdHJpbmc7CiAgbGFiZWxzOiBSZWNvcmQ8ImVuIiB8ICJ6aC1DTiIgfCAiamEiLCBzdHJpbmc+OwogIHRhZ3M6IHN0cmluZ1tdOwp9OwoKZXhwb3J0IHR5cGUgT2pUZXN0Q2FzZSA9IHsKICBpZD86IHN0cmluZzsKICBpbnB1dDogc3RyaW5nOwogIGV4cGVjdGVkOiBzdHJpbmc7CiAgc2FtcGxlOiBib29sZWFuOwp9OwoKZXhwb3J0IHR5cGUgT2pQcm9ibGVtU3VtbWFyeSA9IHsKICBpZDogc3RyaW5nOwogIHB1YmxpY0lkOiBudW1iZXI7CiAgdGl0bGU6IHN0cmluZzsKICB0aW1lTGltaXRNczogbnVtYmVyOwogIG1lbW9yeUxpbWl0TWI6IG51bWJlcjsKICBkaWZmaWN1bHR5OiBudW1iZXI7CiAgdGFnczogc3RyaW5nW107CiAgYXV0aG9yOiB7IGlkOiBzdHJpbmc7IGRpc3BsYXlOYW1lOiBzdHJpbmc7IGhhbmRsZTogc3RyaW5nIHwgbnVsbCB9OwogIHN1Ym1pc3Npb25Db3VudDogbnVtYmVyOwogIGFjY2VwdGVkQ291bnQ6IG51bWJlcjsKICBjcmVhdGVkQXQ6IHN0cmluZzsKICBwdWJsaXNoZWRBdDogc3RyaW5nIHwgbnVsbDsKfTsKCmV4cG9ydCB0eXBlIE9qUHJvYmxlbSA9IE9qUHJvYmxlbVN1bW1hcnkgJiB7CiAgc3RhdGVtZW50OiBzdHJpbmc7CiAgc3RhdGVtZW50Rm9ybWF0OiBFZGl0b3JpYWxDb250ZW50Rm9ybWF0OwogIHNhbXBsZXM6IEFycmF5PHsgaW5wdXQ6IHN0cmluZzsgb3V0cHV0OiBzdHJpbmcgfT47Cn07CgpleHBvcnQgdHlwZSBPalByb2JsZW1EcmFmdCA9IHsKICBpZDogc3RyaW5nOwogIHB1YmxpY0lkOiBudW1iZXIgfCBudWxsOwogIHN0YXR1czogT2pQcm9ibGVtU3RhdHVzOwogIHRpdGxlOiBzdHJpbmc7CiAgc3RhdGVtZW50OiBzdHJpbmc7CiAgc3RhdGVtZW50Rm9ybWF0OiBFZGl0b3JpYWxDb250ZW50Rm9ybWF0OwogIHRpbWVMaW1pdE1zOiBudW1iZXI7CiAgbWVtb3J5TGltaXRNYjogbnVtYmVyOwogIGRpZmZpY3VsdHk6IG51bWJlcjsKICB0YWdzOiBzdHJpbmdbXTsKICB0ZXN0czogT2pUZXN0Q2FzZVtdOwogIHN0ZFNvdXJjZTogc3RyaW5nOwogIHJldmlld05vdGU6IHN0cmluZzsKICBlZGl0UmV2aXNpb246IG51bWJlcjsKICBhdXRob3I6IHsgaWQ6IHN0cmluZzsgZGlzcGxheU5hbWU6IHN0cmluZzsgaGFuZGxlOiBzdHJpbmcgfCBudWxsIH07CiAgY3JlYXRlZEF0OiBzdHJpbmc7CiAgdXBkYXRlZEF0OiBzdHJpbmc7CiAgcmV2aWV3ZWRBdDogc3RyaW5nIHwgbnVsbDsKICBwdWJsaXNoZWRBdDogc3RyaW5nIHwgbnVsbDsKICBhcmNoaXZlZEF0OiBzdHJpbmcgfCBudWxsOwogIGRlbGV0ZWRBdDogc3RyaW5nIHwgbnVsbDsKfTsKCmV4cG9ydCB0eXBlIE9qUHJvYmxlbUlucHV0ID0gewogIHRpdGxlOiBzdHJpbmc7CiAgc3RhdGVtZW50OiBzdHJpbmc7CiAgc3RhdGVtZW50Rm9ybWF0OiAidGlwdGFwLWpzb24tdjEiOwogIHRpbWVMaW1pdE1zOiBudW1iZXI7CiAgbWVtb3J5TGltaXRNYjogbnVtYmVyOwogIGRpZmZpY3VsdHk6IG51bWJlcjsKICB0YWdzOiBzdHJpbmdbXTsKICB0ZXN0czogT2pUZXN0Q2FzZVtdOwogIHN0ZFNvdXJjZTogc3RyaW5nOwp9OwoKYXN5bmMgZnVuY3Rpb24gcGFyc2VKc29uPFQ+KHJlc3BvbnNlOiBSZXNwb25zZSwgZmFsbGJhY2s6IHN0cmluZyk6IFByb21pc2U8VD4gewogIGNvbnN0IGJvZHkgPSAoYXdhaXQgcmVzcG9uc2UuanNvbigpLmNhdGNoKCgpID0+ICh7fSkpKSBhcyBUICYgeyBlcnJvcj86IHN0cmluZyB9OwogIGlmICghcmVzcG9uc2Uub2spIHsKICAgIHRocm93IG5ldyBBdXRoQXBpRXJyb3IoYm9keS5lcnJvciA/PyBmYWxsYmFjaywgcmVzcG9uc2Uuc3RhdHVzKTsKICB9CiAgcmV0dXJuIGJvZHk7Cn0KCmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb2FkT2pUYWdDYXRhbG9nKCkgewogIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgZmV0Y2goYXBpVXJsKCIvb2ovdGFncyIpLCB7CiAgICBoZWFkZXJzOiB7IGFjY2VwdDogImFwcGxpY2F0aW9uL2pzb24iIH0sCiAgfSk7CiAgcmV0dXJuIHBhcnNlSnNvbjx7IHRhZ3M6IHN0cmluZ1tdOyBncm91cHM6IE9qVGFnR3JvdXBbXSB9PihyZXNwb25zZSwgIk9KX1RBR1NfVU5BVkFJTEFCTEUiKTsKfQoKZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvYWRPalByb2JsZW1zKHBhcmFtczogewogIHF1ZXJ5Pzogc3RyaW5nOwogIGRpZmZpY3VsdHk/OiBudW1iZXI7CiAgdGFnPzogc3RyaW5nOwogIHBhZ2U/OiBudW1iZXI7CiAgbGltaXQ/OiBudW1iZXI7Cn0pIHsKICBjb25zdCBzZWFyY2ggPSBuZXcgVVJMU2VhcmNoUGFyYW1zKCk7CiAgaWYgKHBhcmFtcy5xdWVyeSkgc2VhcmNoLnNldCgicXVlcnkiLCBwYXJhbXMucXVlcnkpOwogIGlmIChwYXJhbXMuZGlmZmljdWx0eSkgc2VhcmNoLnNldCgiZGlmZmljdWx0eSIsIFN0cmluZyhwYXJhbXMuZGlmZmljdWx0eSkpOwogIGlmIChwYXJhbXMudGFnKSBzZWFyY2guc2V0KCJ0YWciLCBwYXJhbXMudGFnKTsKICBzZWFyY2guc2V0KCJwYWdlIiwgU3RyaW5nKHBhcmFtcy5wYWdlID8/IDEpKTsKICBzZWFyY2guc2V0KCJsaW1pdCIsIFN0cmluZyhwYXJhbXMubGltaXQgPz8gMzApKTsKICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGFwaVVybChgL29qL3Byb2JsZW1zPyR7c2VhcmNofWApLCB7CiAgICBoZWFkZXJzOiB7IGFjY2VwdDogImFwcGxpY2F0aW9uL2pzb24iIH0sCiAgfSk7CiAgcmV0dXJuIHBhcnNlSnNvbjx7IHByb2JsZW1zOiBPalByb2JsZW1TdW1tYXJ5W107IHRvdGFsOiBudW1iZXI7IHBhZ2U6IG51bWJlcjsgbGltaXQ6IG51bWJlciB9PihyZXNwb25zZSwgIk9KX1BST0JMRU1TX1VOQVZBSUxBQkxFIik7Cn0KCmV4cG9ydCBhc3luYyBmdW5jdGlvbiBsb2FkT2pQcm9ibGVtKHB1YmxpY0lkOiBudW1iZXIpIHsKICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGFwaVVybChgL29qL3Byb2JsZW1zLyR7cHVibGljSWR9YCksIHsKICAgIGhlYWRlcnM6IHsgYWNjZXB0OiAiYXBwbGljYXRpb24vanNvbiIgfSwKICB9KTsKICByZXR1cm4gKGF3YWl0IHBhcnNlSnNvbjx7IHByb2JsZW06IE9qUHJvYmxlbSB9PihyZXNwb25zZSwgIk9KX1BST0JMRU1fVU5BVkFJTEFCTEUiKSkucHJvYmxlbTsKfQoKZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvYWRNeU9qUHJvYmxlbXMoKSB7CiAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBhdXRoZW50aWNhdGVkRmV0Y2goYXBpVXJsKCIvb2ovbWluZSIpLCB7CiAgICBoZWFkZXJzOiB7IGFjY2VwdDogImFwcGxpY2F0aW9uL2pzb24iIH0sCiAgfSk7CiAgcmV0dXJuIChhd2FpdCBwYXJzZUpzb248eyBwcm9ibGVtczogT2pQcm9ibGVtRHJhZnRbXSB9PihyZXNwb25zZSwgIk9KX1BST0JMRU1TX1VOQVZBSUxBQkxFIikpLnByb2JsZW1zOwp9CgpleHBvcnQgYXN5bmMgZnVuY3Rpb24gbG9hZE9qTW9kZXJhdGlvbihzdGF0dXM6IE9qUHJvYmxlbVN0YXR1cykgewogIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgYXV0aGVudGljYXRlZEZldGNoKAogICAgYXBpVXJsKGAvYWRtaW4vb2ovcHJvYmxlbXM/c3RhdHVzPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHN0YXR1cyl9YCksCiAgICB7IGhlYWRlcnM6IHsgYWNjZXB0OiAiYXBwbGljYXRpb24vanNvbiIgfSB9LAogICk7CiAgcmV0dXJuIChhd2FpdCBwYXJzZUpzb248eyBwcm9ibGVtczogT2pQcm9ibGVtRHJhZnRbXSB9PihyZXNwb25zZSwgIk9KX01PREVSQVRJT05fVU5BVkFJTEFCTEUiKSkucHJvYmxlbXM7Cn0KCmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzdWJtaXRPalByb2JsZW0oaW5wdXQ6IE9qUHJvYmxlbUlucHV0KSB7CiAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBhdXRoZW50aWNhdGVkRmV0Y2goYXBpVXJsKCIvb2ovcHJvYmxlbXMiKSwgewogICAgbWV0aG9kOiAiUE9TVCIsCiAgICBoZWFkZXJzOiB7ICJjb250ZW50LXR5cGUiOiAiYXBwbGljYXRpb24vanNvbiIgfSwKICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGlucHV0KSwKICB9KTsKICByZXR1cm4gKGF3YWl0IHBhcnNlSnNvbjx7IHByb2JsZW06IE9qUHJvYmxlbURyYWZ0IH0+KHJlc3BvbnNlLCAiT0pfU1VCTUlUX0ZBSUxFRCIpKS5wcm9ibGVtOwp9CgpleHBvcnQgYXN5bmMgZnVuY3Rpb24gdXBkYXRlT3duT2pQcm9ibGVtKHByb2JsZW1JZDogc3RyaW5nLCBpbnB1dDogT2pQcm9ibGVtSW5wdXQpIHsKICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGF1dGhlbnRpY2F0ZWRGZXRjaChhcGlVcmwoYC9vai9wcm9ibGVtcy8ke2VuY29kZVVSSUNvbXBvbmVudChwcm9ibGVtSWQpfWApLCB7CiAgICBtZXRob2Q6ICJQVVQiLAogICAgaGVhZGVyczogeyAiY29udGVudC10eXBlIjogImFwcGxpY2F0aW9uL2pzb24iIH0sCiAgICBib2R5OiBKU09OLnN0cmluZ2lmeShpbnB1dCksCiAgfSk7CiAgcmV0dXJuIChhd2FpdCBwYXJzZUpzb248eyBwcm9ibGVtOiBPalByb2JsZW1EcmFmdCB9PihyZXNwb25zZSwgIk9KX1VQREFURV9GQUlMRUQiKSkucHJvYmxlbTsKfQoKZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHVwZGF0ZUFkbWluT2pQcm9ibGVtKHByb2JsZW1JZDogc3RyaW5nLCBpbnB1dDogT2pQcm9ibGVtSW5wdXQpIHsKICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGF1dGhlbnRpY2F0ZWRGZXRjaChhcGlVcmwoYC9hZG1pbi9vai9wcm9ibGVtcy8ke2VuY29kZVVSSUNvbXBvbmVudChwcm9ibGVtSWQpfWApLCB7CiAgICBtZXRob2Q6ICJQVVQiLAogICAgaGVhZGVyczogeyAiY29udGVudC10eXBlIjogImFwcGxpY2F0aW9uL2pzb24iIH0sCiAgICBib2R5OiBKU09OLnN0cmluZ2lmeShpbnB1dCksCiAgfSk7CiAgcmV0dXJuIChhd2FpdCBwYXJzZUpzb248eyBwcm9ibGVtOiBPalByb2JsZW1EcmFmdCB9PihyZXNwb25zZSwgIk9KX1VQREFURV9GQUlMRUQiKSkucHJvYmxlbTsKfQoKZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIG1vZGVyYXRlT2pQcm9ibGVtKAogIHByb2JsZW1JZDogc3RyaW5nLAogIHN0YXR1czogInB1Ymxpc2hlZCIgfCAicmVqZWN0ZWQiLAogIHJldmlld05vdGU6IHN0cmluZywKKSB7CiAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBhdXRoZW50aWNhdGVkRmV0Y2goYXBpVXJsKGAvaWRtaW4vb2ovcHJvYmxlbXMvJHtlbmNvZGVVUklDb21wb25lbnQocHJvYmxlbUlkKX1gKSwgewogICAgbWV0aG9kOiAiUEFUQ0giLAogICAgaGVhZGVyczogeyAiY29udGVudC10eXBlIjogImFwcGxpY2F0aW9uL2pzb24iIH0sCiAgICBib2R5OiBKU09OLnN0cmluZ2lmeSh7IHN0YXR1cywgcmV2aWV3Tm90ZSB9KSwKICB9KTsKICByZXR1cm4gKGF3YWl0IHBhcnNlSnNvbjx7IHByb2JsZW06IE9qUHJvYmxlbURyYWZ0IH0+KHJlc3BvbnNlLCAiT0pfUkVWSUVXX0ZBSUxFRCIpKS5wcm9ibGVtOwp9CgpleHBvcnQgYXN5bmMgZnVuY3Rpb24gbWFuYWdlT2pQcm9ibGVtTGlmZWN5Y2xlKAogIHByb2JsZW1JZDogc3RyaW5nLAogIGFjdGlvbjogImFyY2hpdmUiIHwgInJlc3RvcmUiIHwgImRlbGV0ZSIsCikgewogIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgYXV0aGVudGljYXRlZEZldGNoKGFwaVVybChgL2FkbWluL29qL3Byb2JsZW1zLyR7ZW5jb2RlVVJJQ29tcG9uZW50KHByb2JsZW1JZCl9YCksIHsKICAgIG1ldGhvZDogIlBBVENIIiwKICAgIGhlYWRlcnM6IHsgImNvbnRlbnQtdHlwZSI6ICJhcHBsaWNhdGlvbi9qc29uIiB9LAogICAgYm9keTogSlNPTi5zdHJpbmdpZnk({ action }),
  });
  return (await parseJson<{ problem: OjProblemDraft }>(response, "OJ_LIFECYCLE_FAILED")).problem;
}

export async function submitOjSolution(publicId: number, source: string) {
  const response = await authenticatedFetch(apiUrl(`/oj/problems/${publicId}/submissions`), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ source }),
  });
  return (await parseJson<{ submission: JudgeSubmissionState }>(response, "OJ_SUBMISSION_FAILED")).submission;
}
","components/oj-hub.tsx":"InVzZSBjbGllbnQiOwoKaW1wb3J0IEVkaXRvciBmcm9tICJAbW9uYWNvLWVkaXRvci9yZWFjdCI7CmltcG9ydCB7IEZvcm1FdmVudCwgdXNlQ2FsbGJhY2ssIHVzZUVmZmVjdCwgdXNlTWVtbywgdXNlU3RhdGUgfSBmcm9tICJyZWFjdCI7CmltcG9ydCB7CiAgRWRpdG9yaWFsQ29tcG9zZXIsCiAgRWRpdG9yaWFsUmljaFRleHQsCiAgZW1wdHlFZGl0b3JpYWxEb2N1bWVudCwKfSBmcm9tICJAL2NvbXBvbmVudHMvZWRpdG9yaWFsLXJpY2gtdGV4dCI7CmltcG9ydCB7CiAgQXV0aEFwaUVycm9yLAogIGxvYWRKdWRnZVN1Ym1pc3Npb24sCiAgdHlwZSBKdWRnZVN1Ym1pc3Npb25TdGF0ZSwKICB0eXBlIFBsYXllciwKfSBmcm9tICJAL2xpYi9hcGktY2xpZW50IjsKaW1wb3J0IHR5cGUgeyBMb2NhbGUgfSBmcm9tICJAL2xpYi9pMThuIjsKaW1wb3J0IHsKICBsb2FkTXlPalByb2JsZW1zLAogIGxvYWRPak1vZGVyYXRpb24sCiAgbG9hZE9qUHJvYmxlbSwKICBsb2FkT2pQcm9ibGVtcywKICBsb2FkT2pUYWdDYXRhbG9nLAogIG1hbmFnZU9qUHJvYmxlbUxpZmVjeWNsZSwKICBtb2RlcmF0ZU9qUHJvYmxlbSwKICBzdWJtaXRPalByb2JsZW0sCiAgc3VibWl0T2pTb2x1dGlvbiwKICB1cGRhdGVBZG1pbk9qUHJvYmxlbSwKICB1cGRhdGVPd25PalByb2JsZW0sCiAgdHlwZSBPalByb2JsZW0sCiAgdHlwZSBPalByb2JsZW1EcmFmdCwKICB0eXBlIE9qUHJvYmxlbUlucHV0LAogIHR5cGUgT2pQcm9ibGVtU3RhdHVzLAogIHR5cGUgT2pQcm9ibGVtU3VtbWFyeSwKICB0eXBlIE9qVGFnR3JvdXAsCiAgdHlwZSBPalRlc3RDYXNlLAp9IGZyb20gIkAvbGliL29qLWFwaSI7Cgp0eXBlIFZpZXcgPSAiaW5kZXgiIHwgInByb2JsZW0iIHwgImVkaXQiIHwgIm1pbmUiIHwgInJldmlldyI7Cgpjb25zdCBkZWZhdWx0Q29kZSA9IGAjaW5jbHVkZSA8Yml0cy9zdGRjKysuaD4KdXNpbmcgbmFtZXNwYWNlIHN0ZDsKCmludCBtYWluKCkgewogICAgaW9zOjpzeW5jX3dpdGhfc3RkaW8oZmFsc2UpOwogICAgY2luLnRpZShudWxscHRyKTsKCiAgICByZXR1cm4gMDsKfQpgOwpjb25zdCBibGFua1Rlc3QgPSAoc2FtcGxlID0gZmFsc2UpOiBPalRlc3RDYXNlID0+ICh7IGlucHV0OiAiIiwgZXhwZWN0ZWQ6ICIiLCBzYW1wbGUgfSk7CmNvbnN0IGJsYW5rUHJvYmxlbSA9ICgpOiBPalByb2JsZW1JbnB1dCA9PiAoewogIHRpdGxlOiAiIiwKICBzdGF0ZW1lbnQ6IGVtcHR5RWRpdG9yaWFsRG9jdW1lbnQsCiAgc3RhdGVtZW50Rm9ybWF0OiAidGlwdGFwLWpzb24tdjEiLAogIHRpbWVMaW1pdE1zOiAxMDAwLAogIG1lbW9yeUxpbWl0TWI6IDI1NiwKICBkaWZmaWN1bHR5OiAzLAogIHRhZ3M6IFtdLAogIHRlc3RzOiBbYmxhbmtUZXN0KHRydWUpLCBibGFua1Rlc3QoZmFsc2UpXSwKICBzdGRTb3VyY2U6IGRlZmF1bHRDb2RlLAp9KTsKCmNvbnN0IHRyYW5zbGF0aW9ucyA9IHsKICBlbjogewogICAgdGl0bGU6ICJQcm9ibGVtIEFyY2hpdmUiLCBpbmRleDogIlBST0JMRU1TIiwgY3JlYXRlOiAiTkVXIFBST0JMRU0iLCBtaW5lOiAiTVkgUFJPQkxFTVMiLCByZXZpZXc6ICJNT0RFUkFUSU9OIiwKICAgIHNlYXJjaDogIklEIG9yIHRpdGxlIiwgZGlmZmljdWx0eTogIkRJRkZJQ1VMVFkiLCB0YWdzOiAiVEFHUyIsIGFjY2VwdGFuY2U6ICJBQ0NFUFRBTkNFIiwgYXV0aG9yOiAiQVVUSE9SIiwKICAgIGxpbWl0czogIkxJTUlUUyIsIHNhbXBsZXM6ICJTQU1QTEVTIiwgaW5wdXQ6ICJJTlBVVCIsIG91dHB1dDogIk9VVFBVVCIsIHNvbHV0aW9uOiAiQysrMTQgU09MVVRJT04iLAogICAgc3VibWl0OiAiU1VCTUlUIiwgbG9naW46ICJMT0dJTiBUTyBTVUJNSVQiLCBiYWNrOiAiQkFDSyIsIG5vUHJvYmxlbXM6ICJObyBtYXRjaGluZyBwcm9ibGVtcy4iLAogICAgc3RhdGVtZW50OiAiUklDSCBQUk9CTEVNIFNUQVRFTUVOVCIsIHRpdGxlRmllbGQ6ICJQcm9ibGVtIHRpdGxlIiwgdGltZTogIlRpbWUgbGltaXQgKG1zKSIsIG1lbW9yeTogIk1lbW9yeSBsaW1pdCAoTUIpIiwKICAgIHRhZ1NlYXJjaDogIlNlYXJjaCB0YWdzIiwgdGVzdHM6ICJURVNUIERBVEEiLCBhZGRUZXN0OiAiQUREIFRFU1QiLCBzYW1wbGU6ICJQdWJsaWMgc2FtcGxlIiwgcmVtb3ZlOiAiUkVNT1ZFIiwKICAgIHN0ZDogIlN0YW5kYXJkIEMrKzE0IHNvbHV0aW9uIiwgc2F2ZTogIlNFTkQgRk9SIFJFVklFVyIsIHVwZGF0ZTogIlVQREFURSAmaCBSRS1SRVZJRVciLCBlZGl0OiAiRURJVCIsCiAgICBhcHByb3ZlOiAiQVBQUk9WRSIsIHJlamVjdDogIlJFSkVDVCIsIGFyY2hpdmU6ICJBUkNISVZFIiwgcmVzdG9yZTogIlJFU1RPUkUiLCBkZWxldGU6ICJERUxFVEUiLAogICAgbm90ZTogIlJldmlldyBub3RlIiwgcGVuZGluZzogIlBFTkRJTkciLCBwdWJsaXNoZWQ6ICJQVUJMSVNIRUQiLCByZWplY3RlZDogIlJFSkVDVEVEIiwgYXJjaGl2ZWQ6ICJBUkNISVZFRCIsIGRlbGV0ZWQ6ICJERUxFVEVEIiwKICB9LAogICJ6aC1DTiI6IHsKICAgIHRpdGxlOiAiT0og6aKY5bqTIiwgaW5kZXg6ICLpopjnm67liJfooagiLCBjcmVhdGU6ICLmlrDlu7rpopjnm6UiLCBtaW5lOiAi5oiR55qE6aKY55uuIiwgcmV2aWV3OiAi5a6h5qC4566h55CGIiwKICAgIHNlYXJjaDogIumimOWPt+aIluagh+mimCIsIGRpZmZpY3VsdHk6ICLpmr7luqYiLCB0YWdzOiAi5qCH562+IiwgYWNjZXB0YW5jZTogIumAmui/h+eOhyIsIGF1dGhvcjogIuWHuumimOS6uiIsCiAgICBsaW1pdHM6ICLpmZDliLYiLCBzYW1wbGVzOiAi5qC35L6LIiwgaW5wdXQ6ICLoioLngrnkuIYiLCBvdXRwdXQ6ICLoh6rph4/kuIYiLCBzb2x1dGlvbjogIkMrKzE0IOino+etlCIsCiAgICBzdWJtaXQ6ICLmj5DkuqTnoIHotYQiLCBsb2dpbjogIueZu+W9leWQjuS7o+eggSIsIGJhY2s6ICLov5Tlm54iLCBub1Byb2JsZW1zOiAi5rKh5pyJ56ym5ZCI5p2h5Lu255qE6aKY55uu44CCIiwKICAgIHN0YXRlbWVudDogIuWvjOaWh+acrOmimOmdoiIsIHRpdGxlRmllbGQ6ICLpopjnm67moIfpopgiLCB0aW1lOiAi5pe26Ze06ZmQ5Yi277yIbXPvvIkiLCBtZW1vcnk6ICLnqbrpl7TpmZDliLbvvIhNQu+8iSIsCiAgICB0YWdTZWFyY2g6ICLmkJzntKLmoIfnrb4iLCB0ZXN0czogIua1i+ivleaVsOaNriIsIGFkZFRlc3Q6ICLmt7vliqDmtYvor5XngrkiLCBzYW1wbGU6ICLlhazlvIDmoLflvI8iLCByZW1vdmU6ICLliKDpmaQiLAogICAgc3RkOiAiQysrMTQg5qCH5YeG56iL5bqPIiwgc2F2ZTogIuaPkOS6pOWuoeaguCIsIHVwZGF0ZTogIuS/ruaUueW5tumHjeaWsOWuoeaguCIsIGVkaXQ6ICLnvJborpEiLAogICAgYXBwcm92ZTogIumAmui/hyIsIHJlamVjdDogIumps+WbniIsIGFyY2hpdmU6ICLlvZLmoaMiLCByZXN0b3JlOiAi5oGi5aSNIiwgZGVsZXRlOiAi5Yig6ZmkIiwKICAgIG5vdGU6ICLlrqHmoLrmgI/jgocIiwgcGVuZGluZzogIuWuoeaguOS4rSIsIHB1Ymxpc2hlZDogIuW3suWPkeW4gyIsIHJlamVjdGVkOiAi5bey6amz5ZueIiwgYXJjaGl2ZWQ6ICLlt7LlvZLmoaMiLCBkZWxldGVkOiAi5bey5Yig6ZmkIiwKICB9LAogIGphOiB7CiAgICB0aXRsZTogIk9KIOWVj+mhjOW6qyIsIGluZGV4OiAi5ZWP6aGM5LiA6KeI IiwgY3JlYXRlOiAi5paw6KaP5ZWP6aGMIiwgbWluZTogIuiHquWIhuOBruWVj+mhjCIsIHJldmlldzogIuWvqeafu+euoeeQhiIsCiAgICBzZWFyY2g6ICLnlarlj7fjgb7jgZ/jga/jgr/jgqTjg4jjg6siLCBkaWZmaWN1bHR5OiAi6Zuj5piT5bqmIiwgdGFnczogIuOCv+OCsCIsIGFjY2VwdGFuY2U6ICLmraPop6PnjociLCBhdXRob3I6ICLkvZzllY/ogIUiLAogICAgbGltaXRzOiAi5Yi26ZmQ Iiwgc2FtcGxlczogIuOCteODs+ODl+ODqyIsIGlucHV0OiAi5YWl5YqbIiwgb3V0cHV0OiAi5Ye65YqbIiwgc29sdXRpb246ICJDKysxNCDop6PnrZQiLAogICAgc3VibWl0OiAi5o+Q5Ye6IiwgbG9naW46ICLjg63jgrDjgqTjg7PjgZfjgabmj5Dlh7oiLCBiYWNrOiAi5oi744KL Iiwgbm9Qcm9ibGVtczogIuippue9kOOBmeOCi+WVj+mhjOOBjOOBguOCiuOBvuOBm+OCk+OAgiIsCiAgICBzdGF0ZW1lbnQ6ICLjg6rjg4Pjg4HllY/poYzmlociLCB0aXRsZUZpZWxkOiAi5ZWP6aGM44K/44Kk44OI44OrIiwgdGltZTogIuW9k+mWkOWIt+mbhu+8iG1z77yJIiwgbWVtb3J5OiAi44Oh44Oi44Oq77yITULvvIkiLAogICAgdGFnU2VhcmNoOiAi44K/44Kw5qSc57SiIiwgdGVzdHM6ICLjg4bjgrnjg4jjg4fjg7zjgr8iLCBhZGRUZXN0OiAi44OG44K544OI6L+95YqgIiwgc2FtcGxlOiAi5YWs6ZaL5L6LIiwgcmVtb3ZlOiAi5YmK6ZmkIiwKICAgIHN0ZDogIuaomea6liBDKysxNCDop6PnrZQiLCBzYXZlOiAi5a+p5p+744G45o+Q5Ye6IiwgdXBkYXRlOiAi5pu05paw44GX44Gm5YaN5a+p5p+7IiwgZWRpdDogIue3qOmbhiIsCiAgICBhcHByb3ZlOiAi5om/6KqNIiwgcmVqZWN0OiAi5Y205LiLIiwgYXJjaGl2ZTogIuS/neeuuiIsIHJlc3RvcmU6ICLlvqnlhYMiLCBkZWxldGU6ICLliYrpmaQiLAogICAgbm90ZTogIuWvqeafpeOCs+ODoeODs+ODiCIsIHBlbmRpbmc6ICLlr6nmn7vkuK0iLCBwdWJsaXNoZWQ6ICLlhazplovmuIjjgb8iLCByZWplY3RlZDogIuWNo+S4iyIsIGFyY2hpdmVkOiAi5L+d566h5riI44G/IiwgZGVsZXRlZDogIuWJiumZpOa4iOOBvyIsCiAgfSwKfSBhcyBjb25zdDsKCmZ1bmN0aW9uIGVycm9yVGV4dChlcnJvcjogdW5rbm93bikgewogIHJldHVybiBlcnJvciBpbnN0YW5jZW9mIEF1dGhBcGlFcnJvciA/IGVycm9yLmNvZGUgOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6ICJPSl9SRVFVRVNUX0ZBSUxFRCI7Cn0KCmZ1bmN0aW9uIGFjY2VwdGFuY2UocHJvYmxlbTogUGljazxPalByb2JsZW1TdW1tYXJ5LCAic3VibWlzc2lvbkNvdW50IiB8ICJhY2NlcHRlZENvdW50Ij4pIHsKICByZXR1cm4gcHJvYmxlbS5zdWJtaXNzaW9uQ291bnQKICAgID8gYCR7TWF0aC5yb3VuZChwcm9ibGVtLmFjY2VwdGVkQ291bnQgLyBwcm9ibGVtLnN1Ym1pc3Npb25Db3VudCAqIDEwMCl9JWA KICAgIDogIuKAlCI7Cn0KCmV4cG9ydCBmdW5jdGlvbiBPalh1Yih7IHBsYXllciwgbG9jYWxlLCBvbkxvZ2luIH06IHsgcGxheWVyPzogUGxheWVyOyBsb2NhbGU6IExvY2FsZTsgb25Mb2dpbjogKCkgPT4gdm9pZCB9KSB7CiAgY29uc3QgdCA9IHRyYW5zbGF0aW9uc1tsb2NhbGVdOwogIGNvbnN0IGNhblN1Ym1pdCA9IEJvb2xlYW4ocGxheWVyICYmICFwbGF5ZXIuaXNHdWVzdCAmJiBwbGF5ZXIuZW1haWxWZXJpZmllZCk7CiAgY29uc3QgY2FuTWFuYWdlID0gcGxheWVyPy5yb2xlID09PSAiYWRtaW4iIHx8IHBsYXllcj8ucm9sZSA9PT0gIm93bmVyIjsKICBjb25zdCBbdmlldywg setView] = useState<View>("index");
  const [groups, setGroups] = useState<OjTagGroup[]>([]);
  const [problems, setProblems] = useState<OjProblemSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState(0);
  const [tag, setTag] = useState("");
  const [selected, setSelected] = useState<OjProblem>();
  const [mine, setMine] = useState<OjProblemDraft[]>([]);
  const [queue, setQueue] = useState<OjProblemDraft[]>([]);
  const [reviewStatus, setReviewStatus] = useState<OjProblemStatus>("pending");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [form, setForm] = useState<OjProblemInput>(blankProblem);
  const [editing, setEditing] = useState<OjProblemDraft>();
  const [adminEdit, setAdminEdit] = useState(false);
  const [statementCount, setStatementCount] = useState(0);
  const [editorKey, setEditorKey] = useState(0);
  const [tagQuery, setTagQuery] = useState("");
  const [code, setCode] = useState(defaultCode);
  const [judge, setJudge] = useState<JudgeSubmissionState>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const refreshIndex = useCallback(async () => {
    const result = await loadOjProblems({ query, difficulty: difficulty || undefined, tag, page, limit: 30 });
    setProblems(result.problems);
    setTotal(result.total);
  }, [difficulty, page, query, tag]);
  const refreshMine = useCallback(async () => setMine(await loadMyOjProblems()), []);
  const refreshQueue = useCallback(async () => setQueue(await loadOjModeration(reviewStatus)), [reviewStatus]);

  useEffect(() => {
    void loadOjTagCatalog().then((catalog) => setGroups(catalog.groups)).catch((error) => setMessage(errorText(error)));
  }, []);
  useEffect(() => { if (view === "index") void refreshIndex().catch((error) => setMessage(errorText(error))); }, [refreshIndex, view]);
  useEffect(() => { if (view === "mine" && canSubmit) void refreshMine().catch((error) => setMessage(errorText(error))); }, [canSubmit, refreshMine, view]);
  useEffect(() => { if (view === "review" && canManage) void refreshQueue().catch((error) => setMessage(errorText(error))); }, [canManage, refreshQueue, view]);

  const visibleGroups = useMemo(() => {
    const needle = tagQuery.trim().toLowerCase();
    return groups.map((group) => ({
      ...group,
      tags: group.tags.filter((item) => !needle || item.toLowerCase().includes(needle)),
    })).filter((group) => group.tags.length);
  }, [groups, tagQuery]);

  const openProblem = async (publicId: number) => {
    setBusy(true);
    try {
      setSelected(await loadOjProblem(publicId));
      setCode(defaultCode);
      setJudge(undefined);
      setView("problem");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) { setMessage(errorText(error)); }
    finally { setBusy(false); }
  };

  const resetForm = () => {
    setEditing(undefined);
    setAdminEdit(false);
    setForm(blankProblem());
    setStatementCount(0);
    setEditorKey((value) => value + 1);
  };
  const beginCreate = () => { resetForm(); setView("edit"); };
  const beginEdit = (problem: OjProblemDraft, asAdmin = false) => {
    setEditing(problem);
    setAdminEdit(asAdmin);
    setForm({
      title: problem.title,
      statement: problem.statement,
      statementFormat: "tiptap-json-v1",
      timeLimitMs: problem.timeLimitMs,
      memoryLimitMb: problem.memoryLimitMb,
      difficulty: problem.difficulty,
      tags: [...problem.tags],
      tests: problem.tests.map((test) => ({ ...test })),
      stdSource: problem.stdSource,
    });
    setStatementCount(20);
    setEditorKey((value) => value + 1);
    setView("edit");
  };

  const saveProblem = async (event: FormEvent) => {
    event.preventDefault();
    if (form.title.trim().length < 3 || statementCount < 20 || !form.tags.length || !form.tests.some((test) => test.sample)) {
      setMessage("INVALID_OJ_PROBLEM");
      return;
    }
    setBusy(true);
    try {
      if (editing && adminEdit) await updateAdminOjProblem(editing.id, form);
      else if (editing) await updateOwnOjProblem(editing.id, form);
      else await submitOjProblem(form);
      const destination: View = adminEdit ? "review" : "mine";
      resetForm();
      setView(destination);
      setMessage("SAVED_FOR_REVIEW");
    } catch (error) { setMessage(errorText(error)); }
    finally { setBusy(false); }
  };

  const runJudge = async () => {
    if (!selected) return;
    if (!canSubmit) { onLogin(); return; }
    setBusy(true);
    try {
      let state = await submitOjSolution(selected.publicId, code);
      setJudge(state);
      for (let attempt = 0; attempt < 180 && !["DONE", "ERROR"].includes(state.status); attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, state.pollAfterMs ?? 1000));
        state = await loadJudgeSubmission(state.id);
        setJudge(state);
      }
    } catch (error) { setMessage(errorText(error)); }
    finally { setBusy(false); }
  };

  const lifecycle = async (problem: OjProblemDraft, action: "archive" | "restore" | "delete") => {
    if (action === "delete" && !window.confirm(`${t.delete}: ${problem.title}?`)) return;
    setBusy(true);
    try { await manageOjProblemLifecycle(problem.id, action); await refreshQueue(); }
    catch (error) { setMessage(errorText(error)); }
    finally { setBusy(false); }
  };
  const review = async (problem: OjProblemDraft, status: "published" | "rejected") => {
    setBusy(true);
    try { await moderateOjProblem(problem.id, status, reviewNotes[problem.id] ?? ""); await refreshQueue(); }
    catch (error) { setMessage(errorText(error)); }
    finally { setBusy(false); }
  };

  const toggleTag = (value: string) => setForm((current) => ({
    ...current,
    tags: current.tags.includes(value)
      ? current.tags.filter((item) => item !== value)
      : current.tags.length < 12 ? [...current.tags, value] : current.tags,
  }));
  const updateTest = (index: number, patch: Partial<OjTestCase>) => setForm((current) => ({
    ...current,
    tests: current.tests.map((test, itemIndex) => itemIndex === index ? { ...test, ...patch } : test),
  }));

  const statusText = (status: OjProblemStatus) => t[status];
  const privateList = view === "mine" ? mine : queue;

  return <section className="oj-shell">
    <header className="oj-hero"><div><p className="eyebrow">COMMUNITY ONLINE JUDGE</p><h1>{t.title}<span>.exe</span></h1></div><div className="oj-hero-stat"><strong>{total}</strong><span>ONLINE PROBLEMS</span></div></header>
    <nav className="oj-tabs">
      <button className={view === "index" ? "is-active" : ""} onClick={() => setView("index")}>[ {t.index} ]</button>
      <button className={view === "edit" && !editing ? "is-active" : ""} onClick={() => canSubmit ? beginCreate() : onLogin()}>[ {t.create} ]</button>
      {canSubmit && <button className={view === "mine" ? "is-active" : ""} onClick={() => setView("mine")}>[ {t.mine} ]</button>}
      {canManage && <button className={view === "review" ? "is-active" : ""} onClick={() => setView("review")}>[ {t.review} ]</button>}
    </nav>
    {message && <div className="oj-message">{message}</div>}

    {view === "index" && <div className="oj-index">
      <form className="oj-filters" onSubmit={(event) => { event.preventDefault(); setPage(1); void refreshIndex(); }}>
        <label><span>{t.search}</span><input value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label><span>{t.difficulty}</span><select value={difficulty} onChange={(event) => setDifficulty(Number(event.target.value))}><option value={0}>ALL</option>{Array.from({ length: 10 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label>
        <label><span>{t.tags}</span><select value={tag} onChange={(event) => setTag(event.target.value)}><option value="">ALL</option>{groups.map((group) => <optgroup key={group.id} label={group.labels[locale]}>{group.tags.map((item) => <option key={item}>{item}</option>)}</optgroup>)}</select></label>
        <button>SEARCH</button>
      </form>
      <div className="oj-table"><div className="oj-table__head"><span>ID</span><span>{t.title}</span><span>{t.difficulty}</span><span>{t.tags}</span><span>{t.acceptance}</span></div>{!problems.length ? <div className="oj-empty">{t.noProblems}</div> : problems.map((problem) => <button className="oj-problem-row" key={problem.id} onClick={() => void openProblem(problem.publicId)}><strong>#{problem.publicId}</strong><span className="oj-problem-name"><b>{problem.title}</b><small>{problem.author.displayName}</small></span><span>D{problem.difficulty}</span><span className="oj-row-tags">{problem.tags.slice(0, 4).map((item) => <em key={item}>{item}</em>)}</span><span>{acceptance(problem)}<small>{problem.acceptedCount}/{problem.submissionCount}</small></span></button>)}</div>
      <div className="oj-pagination"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>PREV</button><span>{page}/{Math.max(1, Math.ceil(total / 30))}</span><button disabled={page * 30 >= total} onClick={() => setPage((value) => value + 1)}>NEXT</button></div>
    </div>}

    {view === "problem" && selected && <div className="oj-problem-view"><button className="oj-back" onClick={() => setView("index")}>← {t.back}</button><article className="oj-statement"><header><div><span>OJ #{selected.publicId}</span><h2>{selected.title}</h2></div><strong>D{selected.difficulty}</strong></header><div className="oj-problem-meta"><span>{t.author}: <strong>{selected.author.displayName}</strong></span><span>{t.limits}: <strong>{selected.timeLimitMs} ms / {selected.memoryLimitMb} MB</strong></span><span>{t.acceptance}: <strong>{acceptance(selected)}</strong></span></div><EditorialRichText className="oj-statement-text" content={selected.statement} contentFormat={selected.statementFormat} /><div className="oj-statement-tags">{selected.tags.map((item) => <code key={item}>{item}</code>)}</div><h3>{t.samples}</h3>{selected.samples.map((sample, index) => <div className="oj-sample" key={index}><div><span>{t.input}</span><pre>{sample.input}</pre></div><div><span>{t.output}</span><pre>{sample.output}</pre></div></div>)}</article><section className="oj-code-panel"><div className="oj-code-panel__bar"><span>main.cpp</span><span>GNU++14</span></div><Editor height="500px" language="cpp" theme="vs-dark" value={code} onChange={(value) => setCode(value ?? "")} options={{ automaticLayout: true, fontSize: 14, minimap: { enabled: true } }} /><button className="oj-submit-code" disabled={busy} onClick={() => void runJudge()}>{canSubmit ? t.submit : t.login}</button></section>{judge && <section className={`oj-result ${judge.verdict === "AC" ? "oj-result--ac" : ""}`}><header><span>STATUS</span><strong>{judge.verdict ?? judge.status}</strong><span>{judge.score ?? 0}/100</span></header>{judge.compilerOutput && <pre>{judge.compilerOutput}</pre>}</section>}</div>}

    {view === "edit" && canSubmit && <form className="oj-authoring" onSubmit={saveProblem}><header><div><p className="eyebrow">PROBLEM FORGE</p><h2>{editing ? t.update : t.create}</h2></div></header><div className="oj-form-grid"><label className="oj-wide"><span>{t.titleField}</span><input value={form.title} maxLength={160} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label><span>{t.time}</span><input type="number" min={100} max={10000} value={form.timeLimitMs} onChange={(event) => setForm({ ...form, timeLimitMs: Number(event.target.value) })} /></label><label><span>{t.memory}</span><input type="number" min={16} max={1024} value={form.memoryLimitMb} onChange={(event) => setForm({ ...form, memoryLimitMb: Number(event.target.value) })} /></label><label><span>{t.difficulty}</span><select value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: Number(event.target.value) })}>{Array.from({ length: 10 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label></div><section className="oj-rich-statement-editor"><h3>{t.statement}</h3><EditorialComposer key={editorKey} locale={locale} disabled={busy} initialContent={form.statement} initialContentFormat="tiptap-json-v1" onChange={(statement, count, tooLarge) => { setStatementCount(count); if (!tooLarge) setForm((current) => ({ ...current, statement })); }} /><small>{statementCount} characters</small></section><section className="oj-tag-picker"><div><strong>{t.tags}</strong><span>{form.tags.length}/12</span></div><input placeholder={t.tagSearch} value={tagQuery} onChange={(event) => setTagQuery(event.target.value)} /><div className="oj-selected-tags">{form.tags.map((item) => <button type="button" key={item} onClick={() => toggleTag(item)}>{item} ×</button>)}</div>{visibleGroups.map((group) => <div className="oj-tag-group" key={group.id}><h4>{group.labels[locale]}</h4><div className="oj-tag-options">{group.tags.map((item) => <button type="button" className={form.tags.includes(item) ? "is-selected" : ""} key={item} onClick={() => toggleTag(item)}>{item}</button>)}</div></div>)}</section><section className="oj-test-editor"><header><div><strong>{t.tests}</strong><span>{form.tests.length}/50</span></div><button type="button" disabled={form.tests.length >= 50} onClick={() => setForm({ ...form, tests: [...form.tests, blankTest()] })}>{t.addTest}</button></header>{form.tests.map((test, index) => <article key={index}><div className="oj-test-number"><strong>#{String(index + 1).padStart(2, "0")}</strong><label><input type="checkbox" checked={test.sample} onChange={(event) => updateTest(index, { sample: event.target.checked })} /> {t.sample}</label>{form.tests.length > 1 && <button type="button" onClick={() => setForm({ ...form, tests: form.tests.filter((_, itemIndex) => itemIndex !== index) })}>{t.remove}</button>}</div><label><span>{t.input}</span><textarea value={test.input} onChange={(event) => updateTest(index, { input: event.target.value })} /></label><label><span>{t.output}</span><textarea value={test.expected} onChange={(event) => updateTest(index, { expected: event.target.value })} /></label></article>)}</section><label className="oj-std"><span>{t.std}</span><textarea rows={18} value={form.stdSource} onChange={(event) => setForm({ ...form, stdSource: event.target.value })} /></label><button className="primary-button" disabled={busy}>{editing ? t.update : t.save}</button></form>}

    {(view === "mine" || view === "review") && <section className={view === "review" ? "oj-review" : "oj-private-list"}><header><h2>{view === "review" ? t.review : t.mine}</h2>{view === "review" && <select value={reviewStatus} onChange={(event) => setReviewStatus(event.target.value as OjProblemStatus)}>{(["pending", "published", "rejected", "archived", "deleted"] as OjProblemStatus[]).map((status) => <option key={status} value={status}>{statusText(status)}</option>)}</select>}</header>{!privateList.length ? <div className="oj-empty">{t.noProblems}</div> : privateList.map((problem) => <article key={problem.id}><header><div><span className={`oj-status oj-status--${problem.status}`}>{statusText(problem.status)}</span><h3>{problem.title}</h3><small>{problem.author.displayName} · revision {problem.editRevision}</small></div><div className="oj-private-actions"><button onClick={() => beginEdit(problem, view === "review")}>{t.edit}</button>{view === "review" && problem.status !== "archived" && problem.status !== "deleted" && <button onClick={() => void lifecycle(problem, "archive")}>{t.archive}</button>}{view === "review" && problem.status === "archived" && <button onClick={() => void lifecycle(problem, "restore")}>{t.restore}</button>}{view === "review" && problem.status !== "deleted" && <button className="is-danger" onClick={() => void lifecycle(problem, "delete")}>{t.delete}</button>}</div></header><EditorialRichText className="oj-review-statement" content={problem.statement} contentFormat={problem.statementFormat} /><div className="oj-review-meta">{problem.tags.map((item) => <code key={item}>{item}</code>)}</div>{view === "review" && problem.status === "pending" && <div className="oj-review-actions"><textarea placeholder={t.note} value={reviewNotes[problem.id] ?? ""} onChange={(event) => setReviewNotes({ ...reviewNotes, [problem.id]: event.target.value })} /><button className="is-approve" onClick={() => void review(problem, "published")}>{t.approve}</button><button className="is-reject" onClick={() => void review(problem, "rejected")}>{t.reject}</button></div>}{problem.reviewNote && <blockquote>{problem.reviewNote}</blockquote>}</article>)}</section>}
  </section>;
}
","app/player/[handle]/page.tsx":"InVzZSBjbGllbnQiOwoKaW1wb3J0IExpbmsgZnJvbSAibmV4dC9saW5rIjsKaW1wb3J0IHsgdXNlUGFyYW1zIH0gZnJvbSAibmV4dC9uYXZpZ2F0aW9uIjsKaW1wb3J0IHsgdXNlRWZmZWN0LCB1c2VNZW1vLCB1c2VTdGF0ZSB9IGZyb20gInJlYWN0IjsKaW1wb3J0IHN0eWxlcyBmcm9tICIuL3BhZ2UubW9kdWxlLmNzcyI7Cgp0eXBlIFB1YmxpY1BsYXllciA9IHsKICBwcm9maWxlOiB7CiAgICBoYW5kbGU6IHN0cmluZzsKICAgIGRpc3BsYXlOYW1lOiBzdHJpbmc7CiAgICBiaW86IHN0cmluZzsKICAgIGpvaW5lZEF0OiBzdHJpbmc7CiAgfTsKICBzdGF0aXN0aWNzOiB7CiAgICBjbGVhcmVkQ291bnQ6IG51bWJlcjsKICAgIHN1Ym1pc3Npb25Db3VudDogbnVtYmVyOwogICAgYWNjZXB0ZWRDb3VudDogbnVtYmVyOwogICAgYWNjZXB0YW5jZVJhdGU6IG51bWJlcjsKICAgIGN1cnJlbnRTdHJlYWs6IG51bWJlcjsKICAgIGxvbmdlc3RTdHJlYWs6IG51bWJlcjsKICAgIHRvdGFsWHA6IG51bWJlcjsKICAgIGFjaGlldmVtZW50czogQXJyYXk8ewogICAgICBpZDogc3RyaW5nOwogICAgICBpY29uOiBzdHJpbmc7CiAgICAgIHRpdGxlOiBzdHJpbmc7CiAgICAgIGRlc2NyaXB0aW9uOiBzdHJpbmc7CiAgICAgIHVubG9ja2VkQXQ6IHN0cmluZzsKICAgIH0+OwogICAgbWFpbmxpbmU6IHsKICAgICAgdG90YWw6IG51bWJlcjsKICAgICAgY29tcGxldGVkOiBudW1iZXI7CiAgICAgIGNvbXBsZXRlZFF1ZXN0SWRzOiBzdHJpbmdbXTsKICAgIH07CiAgICBhY3Rpdml0eTogQXJyYXk8eyBkYXk6IHN0cmluZzsgdG90YWw6IG51bWJlcjsgYWNjZXB0ZWQ6IG51bWJlciB9PjsKICAgIHJlY2VudFN1Ym1pc3Npb25zOiBBcnJheTx7CiAgICAgIGlkOiBzdHJpbmc7CiAgICAgIHF1ZXN0SWQ6IHN0cmluZzsKICAgICAgdGl0bGU6IHN0cmluZzsKICAgICAgcHVibGljSWQ6IG51bWJlciB8IG51bGw7CiAgICAgIHZlcmRpY3Q6IHN0cmluZzsKICAgICAgc2NvcmU6IG51bWJlcjsKICAgICAgY3JlYXRlZEF0OiBzdHJpbmc7CiAgICB9PjsKICAgIHNvbHZlZE9qOiBBcnJheTx7CiAgICAgIHB1YmxpY0lkOiBudW1iZXI7CiAgICAgIHRpdGxlOiBzdHJpbmc7CiAgICAgIGFjY2VwdGVkQXQ6IHN0cmluZzsKICAgICAgYWNjZXB0ZWRTdWJtaXNzaW9uczogbnVtYmVyOwogICAgfT47CiAgfTsKfTsKCmZ1bmN0aW9uIGRheUtleShkYXRlOiBEYXRlKSB7CiAgcmV0dXJuIGRhdGUudG9JU09TdHJpbmcoKS5zbGljZSgwLCAxMCk7Cn0KCmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIFB1YmxpY1BsYXllclBhZ2UoKSB7CiAgY29uc3QgeyBoYW5kbGUgfSA9IHVzZVBhcmFtczx7IGhhbmRsZTogc3RyaW5nIH0+KCk7CiAgY29uc3QgW2RhdGEsIHNldERhdGFdID0gdXNlU3RhdGU8UHVibGljUGxheWVyPigpOwogIGNvbnN0IFtlcnJvciwgc2V0RXJyb3JdID0gdXNlU3RhdGUoIiIpOwoKICB1c2VFZmZlY3QoKCkgPT4gewogICAgaWYgKCFoYW5kbGUpIHJldHVybjsKICAgIGNvbnN0IGNvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7CiAgICB2b2lkIGZldGNoKGAvYXBpL3YxL3BsYXllcnMvJHtlbmNvZGVVUklDb21wb25lbnQoaGFuZGxlKX1gLCB7CiAgICAgIGhlYWRlcnM6IHsgYWNjZXB0OiAiYXBwbGljYXRpb24vanNvbiIgfSwKICAgICAgc2lnbmFsOiBjb250cm9sbGVyLnNpZ25hbCwKICAgIH0pCiAgICAgIC50aGVuKGFzeW5jIChyZXNwb25zZSkgPT4gewogICAgICAgIGNvbnN0IGJvZHkgPSBhd2FpdCByZXNwb25zZS5qc29uKCkuY2F0Y2goKCkgPT4gKHt9KSk7CiAgICAgICAgaWYgKCFyZXNwb25zZS5vaykgdGhyb3cgbmV3IEVycm9yKGJvZHkuZXJyb3IgPz8gYEhUVFBfJHtyZXNwb25zZS5zdGF0dXN9YCk7CiAgICAgICAgc2V0RGF0YShib2R5KTsKICAgICAgfSkKICAgICAgLmNhdGNoKChjYXVzZSkgPT4gewogICAgICAgIGlmIChjYXVzZSBpbnN0YW5jZW9mIERPTUV4Y2VwdGlvbiAmJiBjYXVzZS5uYW1lID09PSAiQWJvcnRFcnJvciIpIHJldHVybjsKICAgICAgICBzZXRFcnJvcihjYXVzZSBpbnN0YW5jZW9mIEVycm9yID8gY2F1c2UubWVzc2FnZSA6ICJQUk9GSUxFX0xPQURfRkFJTEVEIik7CiAgICAgIH0pOwogICAgcmV0dXJuICgpID0+IGNvbnRyb2xsZXIuYWJvcnQoKTsKICB9LCBbaGFuZGxlXSk7CgogIGNvbnN0IGRheXMgPSB1c2VNZW1vKCgpID0+IHsKICAgIGNvbnN0IGFjdGl2aXR5ID0gbmV3IE1hcChkYXRhPy5zdGF0aXN0aWNzLmFjdGl2aXR5Lm1hcCgoaXRlbSkgPT4gW2l0ZW0uZGF5LCBpdGVtXSkgPz8gW10pOwogICAgcmV0dXJuIEFycmF5LmZyb20oeyBsZW5ndGg6IDM2NSB9LCAoXywgaW5kZXgpID0+IHsKICAgICAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKCk7CiAgICAgIGRhdGUuc2V0VVRDSG91cnMoMCwgMCwgMCwgMCk7CiAgICAgIGRhdGUuc2V0VVRDRGF0ZShkYXRlLmdldFVUQ0RhdGUoKSAtICgzNjQgLSBpbmRleCkpOwogICAgICBjb25zdCBkYXkgPSBkYXlLZXkoZGF0ZSk7CiAgICAgIHJldHVybiB7IGRheSwgdG90YWw6IGFjdGl2aXR5LmdldChkYXkpPy50b3RhbCA/PyAwLCBhY2NlcHRlZDogYWN0aXZpdHkuZ2V0KGRheSk/LmFjY2VwdGVkID8/IDAgfTsKICAgIH0pOwogIH0sIFtkYXRhXSk7CgogIGlmIChlcnJvcikgcmV0dXJuIDxtYWluIGNsYXNzTmFtZT17c3R5bGVzLnBhZ2V9PjxwIGNsYXNzTmFtZT17c3R5bGVzLm5vdGljZX0+e2Vycm9yfTwvcD48L21haW4+OwogIGlmICghZGF0YSkgcmV0dXJuIDxtYWluIGNsYXNzTmFtZT17c3R5bGVzLnBhZ2V9PjxwIGNsYXNzTmFtZT17c3R5bGVzLm5vdGljZX0+TE9BRElORyBQTEFZRVIgUkVDT1JE4oCmPC9wPjwvbWFpbj47CgogIGNvbnN0IHN0YXRpc3RpY3MgPSBkYXRhLnN0YXRpc3RpY3M7CiAgY29uc3QgcHJvZ3Jlc3MgPSBNYXRoLnJvdW5kKHN0YXRpc3RpY3MubWFpbmxpbmUuY29tcGxldGVkIC8gTWF0aC5tYXgoMSwgc3RhdGlzdGljcy5tYWlubGluZS50b3RhbCkgKiAxMDApOwoKICByZXR1cm4gPG1haW4gY2xhc3NOYW1lPXtzdHlsZXMucGFnZX0+PGRpdiBjbGFzc05hbWU9e3N0eWxlcy5zaGVsbH0+CiAgICA8TGluayBjbGFzc05hbWU9e3N0eWxlcy5iYWNrfSBocmVmPSIvIj7ihpAgQUxHT1FVRVNUPC9MaW5rPgogICAgPGhlYWRlciBjbGFzc05hbWU9e3N0eWxlcy5oZXJvfT4KICAgICAgPHNwYW4+UFVCTElDIFBMQVlFUiAvLyBAe2RhdGEucHJvZmlsZS5oYW5kbGV9PC9zcGFuPgogICAgICA8aDE+e2RhdGEucHJvZmlsZS5kaXNwbGF5TmFtZX08L2gxPgogICAgICA8cD57ZGF0YS5wcm9maWxlLmJpbyB8fCAiTm8gYmlvZ3JhcGh5IGhhcyBiZWVuIHB1Ymxpc2hlZC4ifTwvcD4KICAgICAgPHNtYWxsPkpPSU5FRCB7bmV3IERhdGUoZGF0YS5wcm9maWxlLmpvaW5lZEF0KS50b0xvY2FsZURhdGVTdHJpbmcoKX08L3NtYWxsPgogICAgPC9oZWFkZXI+CgogICAgPHNlY3Rpb24gY2xhc3NOYW1lPXtzdHlsZXMubWV0cmljc30+CiAgICAgIDxNZXRyaWMgbGFiZWw9Ik1BSU5MSU5FIiB2YWx1ZT17YCR7c3RhdGlzdGljcy5tYWlubGluZS5jb21wbGV0ZWR9LyR7c3RhdGlzdGljcy5tYWlubGluZS50b3RhbH1gfSAvPgogICAgICA8TWV0cmljIGxhYmVsPSJPSiBTT0xWRUQiIHZhbHVlPXtzdGF0aXN0aWNzLnNvbHZlZE9qLmxlbmd0aH0gLz4KICAgICAgPE1ldHJpYyBsYWJlbD0iQUMgUkFURSIgdmFsdWU9e2Ake3N0YXRpc3RpY3MuYWNjZXB0YW5jZVJhdGV9JWB9IC8+CiAgICAgIDxNZXRyaWMgbGFiZWw9IlNUUkVBSyIgdmFsdWU9e2Ake3N0YXRpc3RpY3MuY3VycmVudFN0cmVha31EYH0gLz4KICAgIDwvc2VjdGlvbj4KCiAgICA8c2VjdGlvbiBjbGFzc05hbWU9e3N0eWxlcy5ibG9ja30+CiAgICAgIDxkaXYgY2xhc3NOYW1lPXtzdHlsZXMuYmxvY2tUaXRsZX0+PGgyPkFDVElWSVRZIC8vIDM2NSBEQVlTPC9oMj48c3Bhbj57c3RhdGlzdGljcy5zdWJtaXNzaW9uQ291bnR9IHN1Ym1pc3Npb25zPC9zcGFuPjwvZGl2PgogICAgICA8ZGl2IGNsYXNzTmFtZT17c3R5bGVzLmhlYXRtYXB9PntkYXlzLm1hcCgoaXRlbSkgPT4gPGkga2V5PXtpdGVtLmRheX0gY2xhc3NOYW1lPXtzdHlsZXNbYGxldmVsJHtNYXRoLm1pbig0LCBpdGVtLnRvdGFsKX1gXX0gdGl0bGU9e2Ake2l0ZW0uZGF5fTogJHtpdGVtLnRvdGFsfSBhY3Rpdml0aWVzLCAke2l0ZW0uYWNjZXB0ZWR9IEFDbH0gLz4pfTwvZGl2PgogICAgPC9zZWN0aW9uPgoKICAgIDxzZWN0aW9uIGNsYXNzTmFtZT17c3R5bGVzLmJsb2NrfT4KICAgICAgPGRpdiBjbGFzc05hbWU9e3N0eWxlcy5ibG9ja1RpdGxlfT48aDI+TUFJTkxJTkUgUFJPR1JFU1M8L2gyPjxzcGFuPntwcm9ncmVzc30lPC9zcGFuPjwvZGl2PgogICAgICA8ZGl2IGNsYXNzTmFtZT17c3R5bGVzLnByb2dyZXNzfT48aSBzdHlsZT17eyB3aWR0aDogYCR7cHJvZ3Jlc3N9JWAgfX0gLz48L2Rpdj4KICAgICAgPGRpdiBjbGFzc05hbWU9e3N0eWxlcy5jaGlwc30+e3N0YXRpc3RpY3MubWFpbmxpbmUuY29tcGxldGVkUXVlc3RJZHMubWFwKChxdWVzdElkKSA9PiA8Y29kZSBrZXk9e3F1ZXN0SWR9PntxdWVzdElkfTwvY29kZT4pfTwvZGl2PgogICAgPC9zZWN0aW9uPgoKICAgIDxzZWN0aW9uIGNsYXNzTmFtZT17c3R5bGVzLmJsb2NrfT4KICAgICAgPGgyPk9KIEFDQ0VQVEVEPC9oMj4KICAgICAgPGRpdiBjbGFzc05hbWU9e3N0eWxlcy5zb2x2ZWR9PntzdGF0aXN0aWNzLnNvbHZlZE9qLmxlbmd0aCA/IHN0YXRpc3RpY3Muc29sdmVkT2oubWFwKChpdGVtKSA9PiA8TGluayBocmVmPXtgLz92aWV3PW9qJnByb2JsZW09JHtpdGVtLnB1YmxpY0lkfWB9IGtleT17aXRlbS5wdWJsaWNJZH0+PHN0cm9uZz4je2l0ZW0ucHVibGljSWR9PC9zdHJvbmc+PHNwYW4+e2l0ZW0udGl0bGV9PC9zcGFuPjxzbWFsbD57bmV3IERhdGUoaXRlbS5hY2NlcHRlZEF0KS50b0xvY2FsZURhdGVTdHJpbmcoKX08L3NtYWxsPjwvTGluaz4pIDogPHA+Tk8gQUNDRVBURUQgT0ogUFJPQkxFTVMgWUVULjwvcD59PC9kaXY+CiAgICA8L3NlY3Rpb24+CgogICAgPHNlY3Rpb24gY2xhc3NOYW1lPXtzdHlsZXMuYmxvY2t9PgogICAgICA8aDI+UkVDRU5UIFNVQk1JU1NJT05TPC9oMj4KICAgICAgPGRpdiBjbGFzc05hbWU9e3N0eWxlcy50YWJsZX0+PHRhYmxlPjx0aGVhZD48dHI+PHRoPlBST0JMRU08L3RoPjx0aD5WRVJESUNUPC90aD48dGg+U0NPUkU8L3RoPjx0aD5USU1FPC90aD48L3RyPjwvdGhlYWQ+PHRib2R5PntzdGF0aXN0aWNzLnJlY2VudFN1Ym1pc3Npb25zLm1hcCgoaXRlbSkgPT4gPHRyIGtleT17aXRlbS5pZH0+PHRkPntpdGVtLnB1YmxpY0lkID8gYCMke2l0ZW0ucHVibGljSWR9ICR7aXRlbS50aXRsZX1gIDogaXRlbS50aXRsZX08L3RkPjx0ZD48YiBjbGFzc05hbWU9e2l0ZW0udmVyZGljdCA9PT0gIkFDIiA/IHN0eWxlcy5hYyA6IHN0eWxlcy53YX0+e2l0ZW0udmVyZGljdH08L2I+PC90ZD48dGQ+e2l0ZW0uc2NvcmV9PC90ZD48dGQ+e25ldyBEYXRlKGl0ZW0uY3JlYXRlZEF0KS50b0xvY2FsZVN0cmluZygpfTwvdGQ+PC90cj4pfTwvdGJvZHk+PC90YWJsZT48L2Rpdj4KICAgIDwvc2VjdGlvbj4KCiAgICA8c2VjdGlvbiBjbGFzc05hbWU9e3N0eWxlcy5ibG9ja30+CiAgICAgIDxoMj5BQ0hJRVZFTUVOVFM8L2gyPgogICAgICA8ZGl2IGNsYXNzTmFtZT17c3R5bGVzLmJhZGdlc30+e3N0YXRpc3RpY3MuYWNoaWV2ZW1lbnRzLm1hcCgoaXRlbSkgPT4gPGFydGljbGUga2V5PXtpdGVtLmlkfT48Yj57aXRlbS5pY29ufTwvYj48ZGl2PjxzdHJvbmc+e2l0ZW0udGl0bGV9PC9zdHJvbmc+PHA+e2l0ZW0uZGVzY3JpcHRpb259PC9wPjwvZGl2Pjx0aW1lPntuZXcgRGF0ZShpdGVtLnVubG9ja2VkQXQpLnRvTG9jYWxlRGF0ZVN0cmluZygpfTwvdGltZT48L2FydGljbGU+KX08L2Rpdj4KICAgIDwvc2VjdGlvbj4KICA8L2Rpdj48L21haW4+Owp9CgpmdW5jdGlvbiBNZXRyaWMoeyBsYWJlbCwgdmFsdWUgfTogeyBsYWJlbDogc3RyaW5nOyB2YWx1ZTogc3RyaW5nIHwgbnVtYmVyIH0pIHsKICByZXR1cm4gPGRpdj48c3Bhbj57bGFiZWx9PC9zcGFuPjxzdHJvbmc+e3ZhbHVlfTwvc3Ryb25nPjwvZGl2PjsKfQo=","app/player/[handle]/page.module.css":"LnBhZ2V7bWluLWhlaWdodDoxMDB2aDtwYWRkaW5nOmNsYW1wKDIwcHgsNXZ3LDcycHgpO2JhY2tncm91bmQ6bGluZWFyLWdyYWRpZW50KHJnYmEoMjEsMjEsMjEsLjA1KSAxcHgsdHJhbnNwYXJlbnQgMXB4KSxsaW5lYXItZ3JhZGllbnQoOTBkZWcscmdiYSgyMSwyMSwyMSwuMDUpIDFweCx0cmFuc3BhcmVudCAxcHgpLCNlY2U3ZGM7YmFja2dyb3VuZC1zaXplOjI0cHggMjRweDtjb2xvcjojMTUxNTE1O2ZvbnQtZmFtaWx5OnVpLW1vbm9zcGFjZSxTRk1vbm8tUmVndWxhcixDb25zb2xhcyxtb25vc3BhY2V9LnNoZWxse21heC13aWR0aDoxMTgwcHg7bWFyZ2luOmF1dG99LmJhY2t7ZGlzcGxheTppbmxpbmUtYmxvY2s7bWFyZ2luLWJvdHRvbToyMnB4O2JvcmRlcjoycHggc29saWQgIzE1MTUxNTtiYWNrZ3JvdW5kOiNmN2YzZWE7Y29sb3I6IzE1MTUxNTtwYWRkaW5nOjlweCAxMnB4O3RleHQtZGVjb3JhdGlvbjpub25lO2ZvbnQtd2VpZ2h0OjkwMDtib3gtc2hhZG93OjRweCA0cHggMCAjMTUxNTE1fS5oZXJve3BhZGRpbmc6Y2xhbXAoMjRweCw1dncsNTRweCk7Ym9yZGVyOjJweCBzb2xpZCAjMTUxNTE1O2JhY2tncm91bmQ6IzE1MTUxNTtjb2xvcjojZjdmM2VhO2JveC1zaGFkb3c6MTBweCAxMHB4IDAgIzA4NzM0N30uaGVybyBzcGFuLC5oZXJvIHNtYWxse2NvbG9yOiM4ZWU4Yjc7Zm9udC1zaXplOjEwcHg7Zm9udC13ZWlnaHQ6OTAwO2xldHRlci1zcGFjaW5nOi4xZW19Lmhlcm8gaDF7bWFyZ2luOjEycHggMDtmb250OjkwMCBjbGFtcCg0MnB4LDh2dyw4NnB4KS8uOSBBcmlhbCxzYW5zLXNlcmlmO2xldHRlci1zcGFjaW5nOi0uMDZlbX0uaGVybyBwe21heC13aWR0aDo3NjBweDt3aGl0ZS1zcGFjZTpwcmUtd3JhcDtsaW5lLWhlaWdodDoxLjc7Y29sb3I6I2Q0Y2VjMn0ubWV0cmljc3tkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdCg0LG1pbm1heCgwLDFmcikpO2dhcDoxMnB4O21hcmdpbi10b3A6MjhweH0ubWV0cmljcz5kaXYsLmJsb2Nre2JvcmRlcjoycHggc29saWQgIzE1MTUxNTtiYWNrZ3JvdW5kOiNmN2YzZWE7Ym94LXNoYWRvdzo1cHggNXB4IDAgIzE1MTUxNX0ubWV0cmljcz5kaXZ7cGFkZGluZzoxNnB4fS5tZXRyaWNzIHNwYW4sLm1ldHJpY3Mgc3Ryb25ne2Rpc3BsYXk6YmxvY2t9Lm1ldHJpY3Mgc3Bhbntmb250LXNpemU6OXB4O2ZvbnQtd2VpZ2h0OjkwMH0ubWV0cmljcyBzdHJvbmd7bWFyZ2luLXRvcDo4cHg7Zm9udDo5MDAgY2xhbXAoMjZweCw0dncsNDRweCkvMSBBcmlhbCxzYW5zLXNlcmlmfS5ibG9ja3ttYXJnaW4tdG9wOjI4cHg7cGFkZGluZzoxOHB4fS5ibG9jayBoMnttYXJnaW46MCAwIDE2cHg7Zm9udDo5MDAgMjZweC8xIEFyaWFsLHNhbnMtc2VyaWZ9LmJsb2NrVGl0bGV7ZGlzcGxheTpmbGV4O2p1c3RpZnktY29udGVudDpzcGFjZS1iZXR3ZWVuO2dhcDoxNnB4O2FsaWduLWl0ZW1zOmNlbnRlcn0uYmxvY2tUaXRsZSBzcGFue2ZvbnQtc2l6ZToxMHB4O2ZvbnQtd2VpZ2h0OjkwMH0uaGVhdG1hcHtkaXNwbGF5OmdyaWQ7Z3JpZC1hdXRvLWZsb3c6Y29sdW1uO2dyaWQtdGVtcGxhdGUtcm93czpyZXBlYXQoNywxMXB4KTtncmlkLWF1dG8tY29sdW1uczoxMXB4O2dhcDozcHg7b3ZlcmZsb3c6YXV0bztwYWRkaW5nOjhweCAwfS5oZWF0bWFwIGl7ZGlzcGxheTpibG9jaztib3JkZXI6MXB4IHNvbGlkICNjOWMzYjc7YmFja2dyb3VuZDojZTRkZmQ1fS5oZWF0bWFwIC5sZXZlbDF7YmFja2dyb3VuZDojYjhlN2NifS5oZWF0bWFwIC5sZXZlbDJ7YmFja2dyb3VuZDojNzBjNzk3fS5oZWF0bWFwIC5sZXZlbDN7YmFja2dyb3VuZDojMjU5MjYzfS5oZWF0bWFwIC5sZXZlbDR7YmFja2dyb3VuZDojMDc1YTM4fS5wcm9ncmVzc3toZWlnaHQ6MThweDtib3JkZXI6MnB4IHNvbGlkICMxNTE1MTU7YmFja2dyb3VuZDojZGVkOGNhfS5wcm9ncmVzcyBpe2Rpc3BsYXk6YmxvY2s7aGVpZ2h0OjEwMCU7YmFja2dyb3VuZDojMDg3MzQ3fS5jaGlwc3tkaXNwbGF5OmZsZXg7ZmxleC13cmFwOndyYXA7Z2FwOjZweDttYXJnaW4tdG9wOjEycHh9LmNoaXBzIGNvZGV7cGFkZGluZzo0cHggNnB4O2JvcmRlcjoxcHggc29saWQgIzE1MTUxNTtiYWNrZ3JvdW5kOiNkOGYzZTU7Zm9udC1zaXplOjlweH0uc29sdmVke2Rpc3BsYXk7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdCgyLG1pbm1heCgwLDFmcikpO2dhcDoxMHB4fS5zb2x2ZWQgYXtkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOmF1dG8gMWZyIGF1dG87Z2FwOjEwcHg7YWxpZ24taXRlbXM6Y2VudGVyO2JvcmRlcjoycHggc29saWQgIzE1MTUxNTtwYWRkaW5nOjEzcHg7Y29sb3I6IzE1MTUxNTt0ZXh0LWRlY29yYXRpb246bm9uZX0uc29sdmVkIGE6aG92ZXJ7YmFja2dyb3VuZDojZDhmM2U1fS5zb2x2ZWQgc3Ryb25ne2NvbG9yOiMwODczNDd9LnNvbHZlZCBzbWFsbHtmb250LXNpemU6OHB4fS5iYWRnZXN7ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoMixtaW5tYXgoMCwxZnIpKTtnYXA6MTJweH0uYmFkZ2VzIGFydGljbGV7ZGlzcGxheTpncmlkO2dyaWQtdGVtcGxhdGUtY29sdW1uczphdXRvIDFmciBhdXRvO2dhcDoxMnB4O2FsaWduLWl0ZW1zOmNlbnRlcjtib3JkZXI6MnB4IHNvbGlkICMxNTE1MTU7YmFja2dyb3VuZDojZDhmM2U1O3BhZGRpbmc6MTRweH0uYmFkZ2VzIGJ7Zm9udC1zaXplOjI0cHh9LmJhZGdlcyBwe21hcmdpbjo0cHggMDtjb2xvcjojNGM0ZDQ5fS5iYWRnZXMgdGltZXtmb250LXNpemU6OHB4fS50YWJsZXtvdmVyZmxvdzphdXRvfS50YWJsZSB0YWJsZXt3aWR0aDoxMDAlO2JvcmRlci1jb2xsYXBzZTpjb2xsYXBzZX0udGFibGUgdGgsLnRhYmxlIHRke3BhZGRpbmc6MTBweDtib3JkZXItYm90dG9tOjFweCBzb2xpZCAjOTk5O3RleHQtYWxpZ246bGVmdDtmb250LXNpemU6MTBweH0uYWN7Y29sb3I6IzA4NzM0N30ud2F7Y29sb3I6I2E2Mjk0OX0ubm90aWNle21heC13aWR0aDo5MDBweDttYXJnaW46YXV0bztwYWRkaW5nOjI0cHg7Ym9yZGVyOjJweCBzb2xpZCAjMTUxNTE1O2JhY2tncm91bmQ6I2YxZGZhYTtmb250LXdlaWdodDo5MDB9QG1lZGlhKG1heC13aWR0aDo3NjBweCl7Lm1ldHJpY3MsLnNvbHZlZCwuYmFkZ2Vze2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnIgMWZyfS5wYWdle3BhZGRpbmc6MThweH19QG1lZGlhKG1heC13aWR0aDo0ODBweCl7Lm1ldHJpY3MsLnNvbHZlZCwuYmFkZ2Vze2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnJ9fQo=","services/api/migrations/101_oj_lifecycle_rich_text.sql":"QUxURVIgVEFCTEUgb2pfcHJvYmxlbXMgRFJPUCBDT05TVFJBSU5UIElGIEVYSVNUUyBval9wcm9ibGVtc19zdGF0dXNfY2hlY2s7CkFMVEVSIFRBQkxFIG9qX3Byb2JsZW1zCiAgQUREIENPTFVNTiBJRiBOT1QgRVhJU1RTIHN0YXRlbWVudF9mb3JtYXQgdmFyY2hhcigyNCkgTk9UIE5VTEwgREVGQVVMVCAndGlwdGFwLWpzb24tdjEnLAogIEFERCBDT0xVTU4gSUYgTk9UIEVYSVNUUyBlZGl0X3JldmlzaW9uIGludGVnZXIgTk9UIE5VTEwgREVGQVVMVCAxIENIRUNLIChlZGl0X3JldmlzaW9uID49IDEpLAogIEFERCBDT0xVTU4gSUYgTk9UIEVYSVNUUyBhcmNoaXZlZF9hdCB0aW1lc3RhbXB0eiwKICBBREQgQ09MVU1OIElGIE5PVCBFWElTVFMgYXJjaGl2ZWRfYnkgdXVpZCBSRUZFUkVOQ0VTIHVzZXJzKGlkKSBPTiBERUxFVEUgU0VUIE5VTEwsCiAgQUREIENPTFVNTiBJRiBOT1QgRVhJU1RTIGRlbGV0ZWRfYXQgdGltZXN0YW1wdHosCiAgQUREIENPTFVNTiBJRiBOT1QgRVhJU1RTIGRlbGV0ZWRfYnkgdXVpZCBSRUZFUkVOQ0VTIHVzZXJzKGlkKSBPTiBERUxFVEUgU0VUIE5VTEw7CkFMVEVSIFRBQkxFIG9qX3Byb2JsZW1zCiAgQUREIENPTlNUUkFJTlQgb2pfcHJvYmxlbXNfc3RhdHVzX2NoZWNrCiAgQ0hFQ0sgKHN0YXR1cyBJTiAoJ3BlbmRpbmcnLCAncHVibGlzaGVkJywgJ3JlamVjdGVkJywgJ2FyY2hpdmVkJywgJ2RlbGV0ZWQnKSk7CkFMVEVSIFRBQkxFIG9qX3Byb2JsZW1zIERST1AgQ09OU1RSQUlOVCBJRiBFWElTVFMgb2pfcHJvYmxlbXNfc3RhdGVtZW50X2Zvcm1hdF9jaGVjazsKQUxURVIgVEFCTEUgb2pfcHJvYmxlbXMKICBBREQgQ09OU1RSQUlOVCBval9wcm9ibGVtc19zdGF0ZW1lbnRfZm9ybWF0X2NoZWNrCiAgQ0hFQ0sgKHN0YXRlbWVudF9mb3JtYXQgPSAndGlwdGFwLWpzb24tdjEnKTsKQ1JFQVRFIElOREVYIElGIE5PVCBFWElTVFMgb2pfcHJvYmxlbXNfbW9kZXJhdGlvbl9pbmRleAogIE9OIG9qX3Byb2JsZW1zKHN0YXR1cywgdXBkYXRlZF9hdCBERVNDKTsKCkFMVEVSIFRBQkxFIHBsYXllcl9wcm9maWxlcyBBTFRFUiBDT0xVTU4gaXNfcHVibGljIFNFVCBERUZBVUxUIHRydWU7ClVQREFURSBwbGF5ZXJfcHJvZmlsZXMgU0VUIGlzX3B1YmxpYyA9IHRydWU7Cg==","tests/codebase-cleanup.test.mjs":"aW1wb3J0IGFzc2VydCBmcm9tICJub2RlOmFzc2VydC9zdHJpY3QiOwppbXBvcnQgeyBhY2Nlc3MsIHJlYWRGaWxlIH0gZnJvbSAibm9kZTpmcy9wcm9taXNlcyI7CmltcG9ydCB0ZXN0IGZyb20gIm5vZGU6dGVzdCI7Cgpjb25zdCByZWFkID0gKHBhdGgpID0+IHJlYWRGaWxlKG5ldyBVUkwoYC4uLyR7cGF0aH1gLCBpbXBvcnQubWV0YS51cmwpLCAidXRmOCIpOwoKYXN5bmMgZnVuY3Rpb24gbWlzc2luZyhwYXRoKSB7CiAgdHJ5IHsgYXdhaXQgYWNjZXNzKG5ldyBVUkwoYC4uLyR7cGF0aH1gLCBpbXBvcnQubWV0YS51cmwpKTsgcmV0dXJuIGZhbHNlOyB9CiAgY2F0Y2ggeyByZXR1cm4gdHJ1ZTsgfQp9Cgp0ZXN0KCJ0aGUgd2ViIHJ1bnRpbWUgaXMgbmF0aXZlIE5leHQuanMgb25seSIsIGFzeW5jICgpID0+IHsKICBjb25zdCBbcGtnLCBkb2NrZXJmaWxlLCBuZXh0Q29uZmlnXSA9IGF3YWl0IFByb21pc2UuYWxsKFsKICAgIHJlYWQoInBhY2thZ2UuanNvbiIpLAogICAgcmVhZCgiZGVwbG95L2RvY2tlci9Eb2NrZXJmaWxlLndlYiIpLAogICAgcmVhZCgibmV4dC5jb25maWcudHMiKSwKICBdKTsKICBhc3NlcnQuZG9lc05vdE1hdGNoKHBrZywgL3ZpbmV4dHx3cmFuZ2xlcnxAY2xvdWRmbGFyZVwvdml0ZS1wbHVnaW58ZHJpenpsZS1vcm0vKTsKICBhc3NlcnQubWF0Y2gocGtnLCAvImRldiI6ICJuZXh0IGRldi8pOwogIGFzc2VydC5tYXRjaChkb2NrZXJmaWxlLCAvXC5uZXh0XC9zdGFuZGFsb25lLyk7CiAgYXNzZXJ0Lm1hdGNoKG5leHRDb25maWcsIC9vdXRwdXQ6ICJzdGFuZGFsb25lIi8pOwogIGZvciAoY29uc3QgcGF0aCBvZiBbInZpdGUuY29uZmlnLnRzIiwgIndvcmtlci9pbmRleC50cyIsICJhcHAvY2hhdGdwdC1hdXRoLnRzIiwgImV4YW1wbGVzL2QxL2RiL3NjaGVtYS50cyJdKSB7CiAgICBhc3NlcnQuZXF1YWwoYXdhaXQgbWlzc2luZyhwYXRoKSwgdHJ1ZSwgYCR7cGF0aH0gc2hvdWxkIGJlIHJlbW92ZWRgKTsKICB9Cn0pOwoKdGVzdCgidGhlIGxlYXJuaW5nIHN5c3RlbSBpcyBhbiBleHBsaWNpdCBtb2R1bGUsIG5vdCBhIHByb2Nlc3MgbW9ua2V5IHBhdGNoIiwgYXN5bmMgKCkgPT4gewogIGNvbnN0IFtzZXJ2ZXIsIGxlYXJuaW5nLCBhcGlQYWNrYWdlXSA9IGF3YWl0IFByb21pc2UuYWxsKFsKICAgIHJlYWQoInNlcnZpY2VzL2FwaS9zcmMvc2VydmVyLm1qcyIpLAogICAgcmVhZCgic2VydmljZXMvYXBpL3NyYy9sZWFybmluZy1zeXN0ZW0ubWpzIiksCiAgICByZWFkKCJzZXJ2aWNlcy9hcGkvcGFja2FnZS5qc29uIiksCiAgXSk7CiAgYXNzZXJ0Lm1hdGNoKHNlcnZlciwgL2hhbmRsZUxlYXJuaW5nUm91dGUvKTsKICBhc3NlcnQubWF0Y2goc2VydmVyLCAvZW5zdXJlUXVlc3RSdWxlQWNjZXNzLyk7CiAgYXNzZXJ0LmRvZXNOb3RNYXRjaChsZWFybmluZywgL2h0dHBcLmNyZWF0ZVNlcnZlclxzKj0vKTsKICBhc3NlcnQuZG9lc05vdE1hdGNoKGxlYXJuaW5nLCAvZGF0YTp0ZXh0XC9qYXZhc2NyaXB0Lyk7CiAgYXNzZXJ0LmVxdWFsKGF3YWl0IG1pc3NpbmcoInNlcnZpY2VzL2FwaS9zcmMvbGVhcm5pbmctZXh0ZW5zaW9uLm1qcyIpLCB0cnVlKTsKICBhc3NlcnQuZG9lc05vdE1hdGNoKGFwaVBhY2thZ2UsIC8tLWltcG9ydC8pOwp9KTsKCnRlc3QoIk9KIHVzZXMgcmljaCBzdGF0ZW1lbnRzLCBjYXRlZ29yaXplZCB0YWdzIGFuZCBjb21wbGV0ZSBsaWZlY3ljbGUiLCBhc3luYyAoKSA9PiB7CiAgY29uc3QgW29qLCBzZXJ2ZXIsIG1pZ3JhdGlvbiwgaHViXSA9IGF3YWl0IFByb21pc2UuYWxsKFsKICAgIHJlYWQoInNlcnZpY2VzL2FwaS9zcmMvb2oubWpzIiksCiAgICByZWFkKCJzZXJ2aWNlcy9hcGkvc3JjL3NlcnZlci5tanMiKSwKICAgIHJlYWQoInNlcnZpY2VzL2FwaS9taWdyYXRpb25zLzEwMV9val9saWZlY3ljbGVfcmljaF90ZXh0LnNxbCIpLAogICAgcmVhZCgiY29tcG9uZW50cy9vai1odWIudHN4IiksCiAgXSk7CiAgYXNzZXJ0Lm1hdGNoKG9qLCAvb2lBbGdvcml0aG1UYWdHcm91cHMvKTsKICBhc3NlcnQubWF0Y2gob2osIC9PSl9SSUNIX1NUQVRFTUVOVF9SRVFVSVJFRC8pOwogIGZvciAoY29uc3Qgc3RhdHVzIG9mIFsiYXJjaGl2ZWQiLCAiZGVsZXRlZCJdKSBhc3NlcnQubWF0Y2gobWlncmF0aW9uLCBuZXcgUmVnRXhwKHN0YXR1cykpOwogIGZvciAoY29uc3QgYWN0aW9uIG9mIFsiYXJjaGl2ZSIsICJyZXN0b3JlIiwgImRlbGV0ZSJdKSBhc3NlcnQubWF0Y2goc2VydmVyLCBuZXcgUmVnRXhwKGAke2FjdGlvbn1PalByb2JsZW1gKSk7CiAgYXNzZXJ0Lm1hdGNoKGh1YiwgL0VkaXRvcmlhbENvbXBvc2VyLyk7CiAgYXNzZXJ0Lm1hdGNoKGh1YiwgL0VkaXRvcmlhbFJpY2hUZXh0Lyk7Cn0pOwoKdGVzdCgi cHVibGljIHBsYXllciBwYWdlIGNvbnRhaW5zIGFjdGl2aXR5LCBtYWlubGluZSBhbmQgYWNjZXB0ZWQgT0ogc2VjdGlvbnMiLCBhc3luYyAoKSA9PiB7CiAgY29uc3QgW3BhZ2UsIGxlYXJuaW5nXSA9IGF3YWl0IFByb21pc2UuYWxsKFsKICAgIHJlYWQoImFwcC9wbGF5ZXIvW2hhbmRsZV0vcGFnZS50c3giKSwKICAgIHJlYWQoInNlcnZpY2VzL2FwaS9zcmMvbGVhcm5pbmctc3lzdGVtLm1qcyIpLAogIF0pOwogIGFzc2VydC5tYXRjaChwYWdlLCAvQUNUSVZJVFkgXFwvXFwgMzY1IERBWVMvKTsKICBhc3NlcnQubWF0Y2gocGFnZSwgL09KIEFDQ0VQVEVELyk7CiAgYXNzZXJ0Lm1hdGNoKHBhZ2UsIC9NQUlOTElORSBQUk9HUkVTUy8pOwogIGFzc2VydC5tYXRjaChsZWFybmluZywgL3JlY2VudFN1Ym1pc3Npb25zLyk7CiAgYXNzZXJ0Lm1hdGNoKGxlYXJuaW5nLCAvc29sdmVkT2ovKTsKfSk7Cg==","docs/CODEBASE_REVIEW.md":"IyBBbGdvUXVlc3QgY29kZWJhc2UgcmV2aWV3IGFuZCBjbGVhbnVwCgojIyBDYW5vbmljYWwgYXJjaGl0ZWN0dXJlCgpBbGdvUXVlc3Qgbm93IGhhcyBvbmUgc3VwcG9ydGVkIGRldmVsb3BtZW50IGFuZCBkZXBsb3ltZW50IHN0YWNrOgoKLSBOZXh0LmpzIEFwcCBSb3V0ZXIgZm9yIHRoZSB3ZWIgYXBwbGljYXRpb24KLSBOb2RlLmpzIENvcmUgQVBJIHdpdGggZXhwbGljaXQgcm91dGUgbW9kdWxlcwotIFBvc3RncmVTUUwgZm9yIGFsbCBwZXJzaXN0ZW50IGFwcGxpY2F0aW9uIGRhdGEKLSBUaGUgaXNvbGF0ZWQgRG9ja2VyIEp1ZGdlIHNlcnZpY2UKLSBOZ2lueCBhcyB0aGUgcHVibGljIHJldmVyc2UgcHJveHkKClRoZSBWaW5leHQvVml0ZS9DbG91ZGZsYXJlIFdvcmtlci9EMSBkZW1vbnN0cmF0aW9uIHN0YWNrIHdhcyByZW1vdmVkLiBJdCBkdXBsaWNhdGVkIHRoZSBwcm9kdWN0aW9uIHJ1bnRpbWUsIGludHJvZHVjZWQgdHdvIGRhdGFiYXNlIG1vZGVscywgYW5kIG1hZGUgbG9jYWwsIENJLCBhbmQgRG9ja2VyIGJlaGF2aW9yIGRpc2FncmVlLgoKIyMgTWFqb3IgY29ycmVjdGlvbnMKCi0gUmVwbGFjZWQgdGhlIGxlYXJuaW5nIGV4dGVuc2lvbidzIEJhc2U2NCBgZGF0YTpgIG1vZHVsZSBhbmQgYGh0dHAuY3JlYXRlU2VydmVyYCBtb25rZXkgcGF0Y2ggd2l0aCBhbiBleHBsaWNpdCBgbGVhcm5pbmctc3lzdGVtLm1qc2Agcm91dGUgbW9kdWxlLgotIEFkZGVkIGNoZWNrc3VtbWVkLCB0cmFuc2FjdGlvbmFsIG1pZ3JhdGlvbiB0cmFja2luZy4KLSBNYWRlIE9KIHByb2JsZW0gc3RhdGVtZW50cyByaWNoLXRleHQgb25seSBhbmQgc2hhcmVkIHRoZSBzYW1lIFRpcHRhcC9LYVRlWCB lZGl0b3IgdXNlZCBieSBkaXNjdXNzaW9ucyBhbmQgc29sdXRpb25zLgotIEFkZGVkIGNhdGVnb3JpemVkIE9JIHRhZ3MgYW5kIHRoZSBjb21wbGV0ZSBwZW5kaW5nL3B1Ymxpc2hlZC9yZWplY3RlZC9hcmNoaXZlZC9kZWxldGVkIGxpZmVjeWNsZS4KLSBBZGRlZCBhdXRob3IgYW5kIGFkbWluaXN0cmF0b3IgZWRpdGluZy4gRXZlcnkgY29udGVudCBlZGl0IHJldHVybnMgYSBwcm9ibGVtIHRvIHJldmlldy4KLSBLZXB0IGRlbGV0aW9uIHNvZnQgc28gaGlzdG9yaWNhbCBzdWJtaXNzaW9ucywgc3RhdGlzdGljcywgYW5kIHBsYXllciBwYWdlcyByZW1haW4gY29oZXJlbnQuCi0gRXhwYW5kZWQgcHVibGljIHBsYXllciBwYWdlcyB3aXRoIGEgMzY1LWRheSBhY3Rpdml0eSBoZWF0bWFwLCBtYWlubGluZSBwcm9ncmVzcywgcmVjZW50IHN1Ym1pc3Npb25zLCBhbmQgYWNjZXB0ZWQgT0ogcHJvYmxlbXMuCi0gU3dpdGNoZWQgdGhlIHdlYiBjb250YWluZXIgdG8gdGhlIG9mZmljaWFsIE5leHQuanMgc3RhbmRhbG9uZSBzZXJ2ZXIuCgojIyBEZWxpYmVyYXRlIGRldmVsb3BtZW50LXN0YWdlIGRlY2lzaW9ucwoKVGhlcmUgaXMgbm8gY29tcGF0aWJpbGl0eSBsYXllciBmb3IgdGhlIHJlbW92ZWQgQ2xvdWRmbGFyZS9EMSBzdGFjayBvciBwbGFpbi10ZXh0IE9KIHN0YXRlbWVudHMuIERldmVsb3BtZW50IGRhdGFiYXNlcyBzaG91bGQgYmUgcmVjcmVhdGVkIHdoZW4gc2NoZW1hIGNoYW5nZXMgYXJlIGludGVudGlvbmFsbHkgZGVzdHJ1Y3RpdmUuIEVkaXRvcmlhbCBwb3N0cyBjb250aW51ZSB0byB1c2UgdGhlIHZhbGlkYXRlZCByaWNoIGRvY3VtZW50IGZvcm1hdCBhbHJlYWR5IHN0b3JlZCBieSB0aGUgYXBwbGljYXRpb24uCgojIyBSZWNvbW1lbmRlZCBuZXh0IHdvcmsKCjEuIFNwbGl0IHRoZSB2ZXJ5IGxhcmdlIGBzZXJ2ZXIubWpzYCwgYGRhdGFiYXNlLm1qc2AsIGBhcGktY2xpZW50LnRzYCwgYGFkbWluLWNvbnNvbGUudHN4YCwgYW5kIGBtaXNzaW9uLXRlcm1pbmFsLnRzeGAgZmlsZXMgYnkgZG9tYWluLiBUaGUgcnVudGltZSBoYWNrcyBhcmUgZ29uZSwgYnV0IHRoZXNlIGZpbGVzIHJlbWFpbiBleHBlbnNpdmUgdG8gcmV2aWV3Lgo yLiBNb3ZlIGJ1aWx0LWluIHF1ZXN0IGNvbnRlbnQgZnJvbSBUeXBlU2NyaXB0IGxpdGVyYWxzIGludG8gdmVyc2lvbmVkIHNlZWQgZGF0YSBzbyB0aGUgc2FtZSBhdXRob3JpbmcgcGlwZWxpbmUgb3ducyBidWlsdC1pbiBhbmQgY3VzdG9tIHF1ZXN0cy4KMy4gQWRkIFBvc3RncmVTUUwgaW50ZWdyYXRpb24gdGVzdHMgd2l0aCBUZXN0Y29udGFpbmVycyBmb3IgbWlncmF0aW9ucywgT0ogbGlmZWN5Y2xlIHRyYW5zaXRpb25zLCBhbmQgY29uY3VycmVudCBzdWJtaXNzaW9uIGNvb2xkb3ducy4KNC4gQWRkIFBsYXl3cmlnaHQgY292ZXJhZ2UgZm9yIHJlZ2lzdHJhdGlvbiwgbWFwIHByb2dyZXNzaW9uLCBPSiBhdXRob3JpbmcsIG1vZGVyYXRpb24sIGFuZCBwdWJsaWMgcHJvZmlsZSBuYXZpZ2F0aW9uLgo1LiBSZXBsYWNlIGRpcmVjdCBEb2NrZXIgc29ja2V0IGFjY2VzcyB3aXRoIGEgbmFycm93bHkgc2NvcGVkIGp1ZGdlLXJ1bm5lciBkYWVtb24gYmVmb3JlIGV4cG9zaW5nIHRoZSBzZXJ2aWNlIHRvIHVudHJ1c3RlZCBvcGVyYXRvcnMuCjYuIEFkZCBvYnNlcnZhYmlsaXR5OiBzdHJ1Y3R1cmVkIGxvZ3MsIHJlcXVlc3QgSURzLCBxdWV1ZSBkZXB0aCwganVkZ2UgbGF0ZW5jeSBwZXJjZW50aWxlcywgYW5kIG1pZ3JhdGlvbi92ZXJzaW9uIGluZm9ybWF0aW9uIGluIGhlYWx0aCBvdXRwdXQuCg=="};

function resolve(relative) {
  return path.join(root, relative);
}

async function read(relative) {
  return readFile(resolve(relative), "utf8");
}

async function write(relative, content) {
  await mkdir(path.dirname(resolve(relative)), { recursive: true });
  await writeFile(resolve(relative), content);
}

async function writeGenerated(relative) {
  const encoded = generatedFiles[relative];
  if (!encoded) throw new Error(`Missing generated payload for ${relative}`);
  await mkdir(path.dirname(resolve(relative)), { recursive: true });
  await writeFile(resolve(relative), Buffer.from(encoded, "base64"));
}

function replaceOnce(source, search, replacement, label) {
  const index = source.indexOf(search);
  if (index < 0) throw new Error(`Cleanup anchor missing: ${label}`);
  if (source.indexOf(search, index + search.length) >= 0) {
    throw new Error(`Cleanup anchor is ambiguous: ${label}`);
  }
  return source.slice(0, index) + replacement + source.slice(index + search.length);
}

function replacePattern(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Cleanup pattern missing: ${label}`);
  pattern.lastIndex = 0;
  return source.replace(pattern, replacement);
}

async function remove(relative) {
  await rm(resolve(relative), { recursive: true, force: true });
}

// Canonical web runtime: Next.js only.
const packageJson = JSON.parse(await read("package.json"));
packageJson.scripts = {
  dev: "next dev --hostname 0.0.0.0",
  build: "next build",
  start: "next start --hostname 0.0.0.0",
  lint: "eslint . --ignore-pattern .next",
  test: "node --test tests/*.test.mjs",
};
delete packageJson.dependencies["drizzle-orm"];
for (const name of [
  "@cloudflare/vite-plugin",
  "@vitejs/plugin-react",
  "@vitejs/plugin-rsc",
  "drizzle-kit",
  "react-server-dom-webpack",
  "vinext",
  "vite",
  "wrangler",
]) delete packageJson.devDependencies[name];
await write("package.json", `${JSON.stringify(packageJson, null, 2)}\n`);
await write(".npmrc", "audit=false\nfund=false\nupdate-notifier=false\ncache=.npm-cache\n");
await write("next.config.ts", `import type { NextConfig } from "next";\n\nconst nextConfig: NextConfig = {\n  output: "standalone",\n  poweredByHeader: false,\n  reactStrictMode: true,\n};\n\nexport default nextConfig;\n`);
await write("deploy/docker/Dockerfile.web", `FROM node:22-bookworm-slim AS dependencies\nWORKDIR /app\nCOPY package.json package-lock.json .npmrc ./\nRUN npm ci\n\nFROM node:22-bookworm-slim AS builder\nWORKDIR /app\nENV NEXT_TELEMETRY_DISABLED=1\nARG NEXT_PUBLIC_API_BASE_URL=/api/v1\nENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL\nCOPY --from=dependencies /app/node_modules ./node_modules\nCOPY . .\nRUN npm run build\n\nFROM node:22-bookworm-slim AS runner\nWORKDIR /app\nENV NODE_ENV=production\nENV NEXT_TELEMETRY_DISABLED=1\nENV HOSTNAME=0.0.0.0\nENV PORT=3000\nRUN groupadd --system --gid 10001 algoquest && useradd --system --uid 10001 --gid algoquest algoquest\nCOPY --from=builder --chown=algoquest:algoquest /app/public ./public\nCOPY --from=builder --chown=algoquest:algoquest /app/.next/standalone ./\nCOPY --from=builder --chown=algoquest:algoquest /app/.next/static ./.next/static\nUSER algoquest\nEXPOSE 3000\nCMD ["node", "server.js"]\n`);

for (const obsolete of [
  ".openai",
  "build",
  "worker",
  "types/cloudflare.d.ts",
  "db",
  "drizzle.config.ts",
  "drizzle",
  "examples/d1",
  "app/chatgpt-auth.ts",
  "vite.config.ts",
  "scripts/build-verified.sh",
  "scripts/install-ci.sh",
  "scripts/sites-env.sh",
  "scripts/validate-artifact.sh",
]) await remove(obsolete);

let ci = await read(".github/workflows/ci.yml");
ci = ci.replace('branches: ["main"]', 'branches: ["main", "agent/**"]');
ci = ci.replace("npm run lint\n          npm test", "npm run lint\n          npm run build\n          npm test");
await write(".github/workflows/ci.yml", ci);

// Replace the runtime source injection and HTTP monkey patch with a normal route module.
const partDirectory = "services/api/src/learning-extension.parts";
const parts = [];
for (let index = 0; index < 8; index += 1) {
  parts.push(await read(`${partDirectory}/${String(index).padStart(2, "0")}.jsfrag`));
}
let learning = parts.join("");
learning = learning.replace('import http from "node:http";\n', "");
learning = learning.replaceAll("ExtensionError", "LearningSystemError");
learning = replaceOnce(
  learning,
  "class LearningSystemError extends Error {",
  "export class LearningSystemError extends Error {",
  "export learning error",
);
learning = replaceOnce(
  learning,
  "async function handleExtensionRoute(request, response) {",
  "export async function handleLearningRoute(request, response) {",
  "export learning route",
);
const replayStart = learning.indexOf("\nasync function replayJudgeSubmission");
if (replayStart < 0) throw new Error("Learning replay marker missing");
learning = `${learning.slice(0, replayStart)}\n\nexport async function closeLearningSystem() {\n  await pool.end();\n}\n`;

learning = learning.replace(
  "VALUES ($1, $2, '', false, false, now(), now())",
  "VALUES ($1, $2, '', true, false, now(), now())",
);
learning = replacePattern(
  learning,
  /async function profileStatistics\(userId\) \{[\s\S]*?\n\}\n\nfunction submissionRow/,
  `async function profileStatistics(userId) {
  const metrics = await loadMetrics(userId);
  const achievements = await syncAchievements(userId, metrics);
  const [progress, activity, recentSubmissions, solvedOj] = await Promise.all([
    pool.query(
      \`SELECT quest_id, best_score, cleared_at, updated_at
         FROM quest_progress
        WHERE user_id = $1 AND status = 'cleared'
        ORDER BY COALESCE(cleared_at, updated_at) DESC\`,
      [userId],
    ),
    pool.query(
      \`SELECT day, SUM(total)::integer AS total, SUM(accepted)::integer AS accepted
         FROM (
           SELECT created_at::date AS day, COUNT(*)::integer AS total,
                  COUNT(*) FILTER (WHERE verdict = 'AC')::integer AS accepted
             FROM submissions
            WHERE user_id = $1 AND created_at >= current_date - 364
            GROUP BY created_at::date
           UNION ALL
           SELECT updated_at::date, COUNT(*)::integer, 0
             FROM quest_progress
            WHERE user_id = $1 AND updated_at >= current_date - 364
            GROUP BY updated_at::date
           UNION ALL
           SELECT started_at::date, COUNT(*)::integer, 0
             FROM learning_sessions
            WHERE user_id = $1 AND started_at >= current_date - 364
            GROUP BY started_at::date
         ) events
        GROUP BY day
        ORDER BY day\`,
      [userId],
    ),
    pool.query(
      \`SELECT s.id, s.quest_id, COALESCE(s.verdict, s.status) AS verdict,
              s.score, s.created_at, p.public_id, COALESCE(p.title, s.quest_id) AS title
         FROM submissions s
         LEFT JOIN oj_problems p ON s.quest_id = 'oj-' || p.public_id::text
        WHERE s.user_id = $1
        ORDER BY s.created_at DESC
        LIMIT 24\`,
      [userId],
    ),
    pool.query(
      \`SELECT p.public_id, p.title, MAX(s.created_at) AS accepted_at,
              COUNT(*)::integer AS accepted_submissions
         FROM submissions s
         JOIN oj_problems p ON s.quest_id = 'oj-' || p.public_id::text
        WHERE s.user_id = $1 AND s.verdict = 'AC' AND p.status <> 'deleted'
        GROUP BY p.public_id, p.title
        ORDER BY accepted_at DESC\`,
      [userId],
    ),
  ]);
  const completedQuestIds = progress.rows.map((row) => row.quest_id);
  const builtInIds = new Set(BUILT_IN_QUESTS.map(([id]) => id));
  return {
    clearedCount: metrics.clearedCount,
    submissionCount: metrics.submissionCount,
    acceptedCount: metrics.acceptedCount,
    acceptanceRate: metrics.acceptanceRate,
    currentStreak: metrics.currentStreak,
    longestStreak: metrics.longestStreak,
    totalXp: metrics.totalXp,
    achievements: achievements.filter((item) => item.unlocked),
    mainline: {
      total: BUILT_IN_QUESTS.length,
      completed: completedQuestIds.filter((id) => builtInIds.has(id)).length,
      completedQuestIds: completedQuestIds.filter((id) => builtInIds.has(id)),
    },
    activity: activity.rows.map((row) => ({
      day: dateKey(row.day), total: row.total, accepted: row.accepted,
    })),
    recentSubmissions: recentSubmissions.rows.map((row) => ({
      id: row.id,
      questId: row.quest_id,
      title: row.title,
      publicId: row.public_id == null ? null : Number(row.public_id),
      verdict: row.verdict,
      score: row.score ?? 0,
      createdAt: asIso(row.created_at),
    })),
    solvedOj: solvedOj.rows.map((row) => ({
      publicId: Number(row.public_id),
      title: row.title,
      acceptedAt: asIso(row.accepted_at),
      acceptedSubmissions: row.accepted_submissions,
    })),
  };
}

function submissionRow`,
  "profile statistics",
);
learning = replacePattern(
  learning,
  /  const publicProfileMatch = url\.pathname\.match\(\/\^\\\/v1\\\/players[\s\S]*?    return true;\n  \}/,
  `  const publicProfileMatch = url.pathname.match(/^\\/v1\\/players\\/([a-z0-9-]{3,32})$/);
  if (request.method === "GET" && publicProfileMatch) {
    const profile = await pool.query(
      \`SELECT u.id AS user_id, u.display_name,
              COALESCE(p.handle,
                lower(regexp_replace(u.display_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || left(u.id::text, 6)
              ) AS handle,
              COALESCE(p.bio, '') AS bio,
              u.created_at AS joined_at
         FROM users u
         LEFT JOIN player_profiles p ON p.user_id = u.id
        WHERE u.is_guest = false
          AND lower(COALESCE(p.handle,
                lower(regexp_replace(u.display_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || left(u.id::text, 6)
              )) = lower($1)\`,
      [publicProfileMatch[1]],
    );
    if (!profile.rowCount) throw new LearningSystemError(404, "PUBLIC_PROFILE_NOT_FOUND");
    const row = profile.rows[0];
    sendJson(response, 200, {
      profile: {
        handle: row.handle,
        displayName: row.display_name,
        bio: row.bio,
        joinedAt: asIso(row.joined_at),
      },
      statistics: await profileStatistics(row.user_id),
    });
    return true;
  }`,
  "public profile route",
);
await write("services/api/src/learning-system.mjs", learning);
await remove("services/api/src/learning-extension.mjs");
await remove(partDirectory);

const apiPackage = JSON.parse(await read("services/api/package.json"));
apiPackage.scripts.start = "node src/server.mjs";
await write("services/api/package.json", `${JSON.stringify(apiPackage, null, 2)}\n`);

// Database migration tracking and complete OJ lifecycle.
let database = await read("services/api/src/database.mjs");
database = replacePattern(
  database,
  /    async migrate\(\) \{[\s\S]*?\n    \},\n\n    async ping/,
  `    async migrate() {
      const migrationsUrl = new URL("../migrations/", import.meta.url);
      const migrationsPath = fileURLToPath(migrationsUrl);
      const files = (await readdir(migrationsPath))
        .filter((name) => /^\\d+_.+\\.sql$/.test(name))
        .sort();
      await pool.query(\`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          filename text PRIMARY KEY,
          checksum text NOT NULL,
          applied_at timestamptz NOT NULL DEFAULT now()
        )
      \`);
      for (const file of files) {
        const sql = await readFile(new URL(file, migrationsUrl), "utf8");
        const checksum = crypto.createHash("sha256").update(sql).digest("hex");
        const existing = await pool.query(
          "SELECT checksum FROM schema_migrations WHERE filename = $1",
          [file],
        );
        if (existing.rowCount) {
          if (existing.rows[0].checksum !== checksum) {
            throw new Error(\`MIGRATION_CHANGED_AFTER_APPLY: ${file}\`);
          }
          continue;
        }
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await client.query(sql);
          await client.query(
            "INSERT INTO schema_migrations(filename, checksum) VALUES ($1, $2)",
            [file, checksum],
          );
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      }
    },

    async ping`,
  "tracked migrations",
);

const ojBlockStart = database.indexOf("    async createOjProblem(");
const ojBlockEnd = database.indexOf("    async close() {", ojBlockStart);
if (ojBlockStart < 0 || ojBlockEnd < 0) throw new Error("OJ database block missing");
const ojDatabaseBlock = `    async createOjProblem(authorId, problem) {
      const id = crypto.randomUUID();
      const result = await pool.query(
        \`INSERT INTO oj_problems
           (id, author_id, status, title, statement, statement_format,
            time_limit_ms, memory_limit_mb, difficulty, tags, tests, std_source)
         VALUES ($1::uuid, $2::uuid, 'pending', $3, $4, $5, $6::integer,
                 $7::integer, $8::smallint, $9::text[], $10::jsonb, $11)
         RETURNING *\`,
        [id, authorId, problem.title, problem.statement, problem.statementFormat,
         problem.timeLimitMs, problem.memoryLimitMb, problem.difficulty,
         problem.tags, JSON.stringify(problem.tests), problem.stdSource],
      );
      return mapOjProblem(result.rows[0]);
    },

    async updateOjProblemDraft(problemId, authorId, problem) {
      const result = await pool.query(
        \`UPDATE oj_problems
            SET title=$3, statement=$4, statement_format=$5,
                time_limit_ms=$6::integer, memory_limit_mb=$7::integer,
                difficulty=$8::smallint, tags=$9::text[], tests=$10::jsonb,
                std_source=$11, status='pending', review_note='', reviewer_id=NULL,
                reviewed_at=NULL, archived_at=NULL, archived_by=NULL,
                edit_revision=edit_revision+1, updated_at=now()
          WHERE id=$1::uuid AND author_id=$2::uuid
            AND status IN ('pending','rejected','published')
          RETURNING *\`,
        [problemId, authorId, problem.title, problem.statement, problem.statementFormat,
         problem.timeLimitMs, problem.memoryLimitMb, problem.difficulty,
         problem.tags, JSON.stringify(problem.tests), problem.stdSource],
      );
      return result.rowCount ? mapOjProblem(result.rows[0]) : undefined;
    },

    async updateOjProblemAsAdmin(problemId, reviewerId, problem) {
      const result = await pool.query(
        \`UPDATE oj_problems
            SET title=$3, statement=$4, statement_format=$5,
                time_limit_ms=$6::integer, memory_limit_mb=$7::integer,
                difficulty=$8::smallint, tags=$9::text[], tests=$10::jsonb,
                std_source=$11, status='pending', review_note='', reviewer_id=$2::uuid,
                reviewed_at=NULL, archived_at=NULL, archived_by=NULL,
                edit_revision=edit_revision+1, updated_at=now()
          WHERE id=$1::uuid AND status <> 'deleted'
          RETURNING *\`,
        [problemId, reviewerId, problem.title, problem.statement, problem.statementFormat,
         problem.timeLimitMs, problem.memoryLimitMb, problem.difficulty,
         problem.tags, JSON.stringify(problem.tests), problem.stdSource],
      );
      return result.rowCount ? mapOjProblem(result.rows[0]) : undefined;
    },

    async listPublishedOjProblems({ query = "", difficulty, tag = "", limit = 30, offset = 0 } = {}) {
      const normalizedQuery = query.trim().slice(0, 160);
      const normalizedDifficulty = Number.isInteger(difficulty) ? difficulty : null;
      const result = await pool.query(
        \`SELECT p.id, p.public_id, p.status, p.title, p.time_limit_ms,
                p.memory_limit_mb, p.difficulty, p.tags, p.created_at,
                p.published_at, p.updated_at,
                u.id AS author_id, u.display_name AS author_name,
                profile.handle AS author_handle,
                COUNT(s.id)::integer AS submission_count,
                COUNT(s.id) FILTER (WHERE s.verdict='AC')::integer AS accepted_count,
                COUNT(*) OVER()::integer AS total_count
           FROM oj_problems p
           JOIN users u ON u.id=p.author_id
           LEFT JOIN player_profiles profile ON profile.user_id=u.id
           LEFT JOIN submissions s ON s.quest_id='oj-' || p.public_id::text
          WHERE p.status='published'
            AND ($1::text='' OR p.title ILIKE '%'||$1::text||'%' OR p.public_id::text=$1::text)
            AND ($2::smallint IS NULL OR p.difficulty=$2::smallint)
            AND ($3::text='' OR $3::text=ANY(p.tags))
          GROUP BY p.id,u.id,profile.handle
          ORDER BY p.public_id DESC
          LIMIT $4::integer OFFSET $5::integer\`,
        [normalizedQuery, normalizedDifficulty, tag.trim().slice(0,80),
         Math.min(100,Math.max(1,limit)), Math.max(0,offset)],
      );
      return { problems: result.rows.map(mapOjProblem), total: result.rows[0]?.total_count ?? 0 };
    },

    async getPublishedOjProblem(publicId) {
      const result = await pool.query(
        \`SELECT p.*, u.id AS author_id, u.display_name AS author_name,
                profile.handle AS author_handle,
                COUNT(s.id)::integer AS submission_count,
                COUNT(s.id) FILTER (WHERE s.verdict='AC')::integer AS accepted_count
           FROM oj_problems p
           JOIN users u ON u.id=p.author_id
           LEFT JOIN player_profiles profile ON profile.user_id=u.id
           LEFT JOIN submissions s ON s.quest_id='oj-' || p.public_id::text
          WHERE p.status='published' AND p.public_id=$1::bigint
          GROUP BY p.id,u.id,profile.handle\`,
        [publicId],
      );
      return result.rowCount ? mapOjProblem(result.rows[0]) : undefined;
    },

    async listAuthorOjProblems(authorId) {
      const result = await pool.query(
        \`SELECT p.*, u.display_name AS author_name, profile.handle AS author_handle
           FROM oj_problems p
           JOIN users u ON u.id=p.author_id
           LEFT JOIN player_profiles profile ON profile.user_id=u.id
          WHERE p.author_id=$1::uuid AND p.status <> 'deleted'
          ORDER BY p.updated_at DESC LIMIT 100\`,
        [authorId],
      );
      return result.rows.map(mapOjProblem);
    },

    async listOjProblemsForModeration(status = "pending") {
      const result = await pool.query(
        \`SELECT p.*, u.display_name AS author_name, profile.handle AS author_handle
           FROM oj_problems p
           JOIN users u ON u.id=p.author_id
           LEFT JOIN player_profiles profile ON profile.user_id=u.id
          WHERE p.status=$1::varchar(16)
          ORDER BY CASE WHEN p.status='pending' THEN p.created_at ELSE p.updated_at END DESC
          LIMIT 200\`,
        [status],
      );
      return result.rows.map(mapOjProblem);
    },

    async moderateOjProblem(problemId, status, reviewerId, reviewNote) {
      const result = await pool.query(
        \`UPDATE oj_problems
            SET status=$2::varchar(16),
                public_id=CASE WHEN $2='published' THEN COALESCE(public_id,nextval('oj_problem_public_id_seq')) ELSE public_id END,
                reviewer_id=$3::uuid, review_note=$4, reviewed_at=now(),
                published_at=CASE WHEN $2='published' THEN COALESCE(published_at,now()) ELSE published_at END,
                updated_at=now()
          WHERE id=$1::uuid AND status IN ('pending','rejected')
          RETURNING *\`,
        [problemId,status,reviewerId,reviewNote],
      );
      return result.rowCount ? mapOjProblem(result.rows[0]) : undefined;
    },

    async archiveOjProblem(problemId, actorId) {
      const result = await pool.query(
        \`UPDATE oj_problems SET status='archived', archived_at=now(), archived_by=$2::uuid, updated_at=now()
          WHERE id=$1::uuid AND status NOT IN ('archived','deleted') RETURNING *\`,
        [problemId,actorId],
      );
      return result.rowCount ? mapOjProblem(result.rows[0]) : undefined;
    },

    async restoreOjProblem(problemId, actorId) {
      const result = await pool.query(
        \`UPDATE oj_problems
            SET status=CASE WHEN public_id IS NULL THEN 'pending' ELSE 'published' END,
                archived_at=NULL, archived_by=NULL, reviewer_id=$2::uuid, updated_at=now()
          WHERE id=$1::uuid AND status='archived' RETURNING *\`,
        [problemId,actorId],
      );
      return result.rowCount ? mapOjProblem(result.rows[0]) : undefined;
    },

    async deleteOjProblem(problemId, actorId) {
      const result = await pool.query(
        \`UPDATE oj_problems
            SET status='deleted', deleted_at=now(), deleted_by=$2::uuid,
                archived_at=NULL, archived_by=NULL, updated_at=now()
          WHERE id=$1::uuid AND status <> 'deleted' RETURNING *\`,
        [problemId,actorId],
      );
      return result.rowCount ? mapOjProblem(result.rows[0]) : undefined;
    },

`;
database = database.slice(0, ojBlockStart) + ojDatabaseBlock + database.slice(ojBlockEnd);
database = replacePattern(
  database,
  /function mapOjProblem\(row\) \{[\s\S]*?\n\}\n\nexport function mapPlayer/,
  `function mapOjProblem(row) {
  return {
    id: row.id,
    publicId: row.public_id == null ? null : Number(row.public_id),
    status: row.status,
    title: row.title,
    statement: row.statement ?? "",
    statementFormat: row.statement_format ?? "tiptap-json-v1",
    timeLimitMs: row.time_limit_ms,
    memoryLimitMb: row.memory_limit_mb,
    difficulty: row.difficulty,
    tags: row.tags ?? [],
    tests: Array.isArray(row.tests) ? row.tests : [],
    stdSource: row.std_source ?? "",
    reviewNote: row.review_note ?? "",
    editRevision: Number(row.edit_revision ?? 1),
    author: {
      id: row.author_id,
      displayName: row.author_name ?? "PLAYER",
      handle: row.author_handle ?? null,
    },
    submissionCount: row.submission_count ?? 0,
    acceptedCount: row.accepted_count ?? 0,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
    reviewedAt: row.reviewed_at?.toISOString?.() ?? row.reviewed_at ?? null,
    publishedAt: row.published_at?.toISOString?.() ?? row.published_at ?? null,
    archivedAt: row.archived_at?.toISOString?.() ?? row.archived_at ?? null,
    deletedAt: row.deleted_at?.toISOString?.() ?? row.deleted_at ?? null,
  };
}

export function mapPlayer`,
  "map OJ problem",
);
await write("services/api/src/database.mjs", database);

// Explicit learning route integration and OJ APIs.
let server = await read("services/api/src/server.mjs");
server = replaceOnce(server, "  oiAlgorithmTags,\n  OjValidationError,", "  oiAlgorithmTagGroups,\n  oiAlgorithmTags,\n  OjValidationError,", "OJ tag group import");
server = replaceOnce(
  server,
  '} from "./security.mjs";\n',
  '} from "./security.mjs";\nimport {\n  closeLearningSystem,\n  ensureQuestRuleAccess,\n  handleLearningRoute,\n  LearningSystemError,\n} from "./learning-system.mjs";\n',
  "learning module import",
);
server = replaceOnce(
  server,
  "  try {\n    if (request.method === \"GET\" && url.pathname === \"/v1/auth/config\") {",
  "  try {\n    if (await handleLearningRoute(request, response)) return;\n\n    if (request.method === \"GET\" && url.pathname === \"/v1/auth/config\") {",
  "learning route dispatch",
);
server = replaceOnce(
  server,
  "return json(response, 200, { tags: oiAlgorithmTags });",
  "return json(response, 200, { tags: oiAlgorithmTags, groups: oiAlgorithmTagGroups });",
  "categorized tag response",
);
server = server.replace(
  "const ojDraftMatch = url.pathname.match(/^\\/v1\\/oj\\/drafts\\/([0-9a-f-]{36})$/i);",
  "const ojDraftMatch = url.pathname.match(/^\\/v1\\/oj\\/problems\\/([0-9a-f-]{36})$/i);",
);
server = server.replace(
  'const status = ["pending", "published", "rejected"].includes(requestedStatus)',
  'const status = ["pending", "published", "rejected", "archived", "deleted"].includes(requestedStatus)',
);
const moderationAnchor = `    const ojModerationMatch = url.pathname.match(/^\\/v1\\/admin\\/oj\\/problems\\/([0-9a-f-]{36})$/i);
    if (request.method === "PATCH" && ojModerationMatch) {`;
server = replaceOnce(
  server,
  moderationAnchor,
  `    const ojModerationMatch = url.pathname.match(/^\\/v1\\/admin\\/oj\\/problems\\/([0-9a-f-]{36})$/i);
    if (request.method === "PUT" && ojModerationMatch) {
      requireAdmin(player);
      const body = await readJson(request, 8 * 1024 * 1024);
      const problem = await database.updateOjProblemAsAdmin(
        ojModerationMatch[1], player.id, validatedOjProblem(body),
      );
      if (!problem) throw new ApiError(404, "OJ_PROBLEM_NOT_EDITABLE");
      return json(response, 200, { problem });
    }
    if (request.method === "PATCH" && ojModerationMatch) {`,
  "admin OJ edit route",
);
server = replaceOnce(
  server,
  `      const body = await readJson(request, 8 * 1024);
      if (body.status !== "published" && body.status !== "rejected") {`,
  `      const body = await readJson(request, 8 * 1024);
      if (["archive", "restore", "delete"].includes(body.action)) {
        const method = body.action === "archive"
          ? "archiveOjProblem"
          : body.action === "restore"
            ? "restoreOjProblem"
            : "deleteOjProblem";
        const problem = await database[method](ojModerationMatch[1], player.id);
        if (!problem) throw new ApiError(404, "OJ_PROBLEM_NOT_MODIFIED");
        return json(response, 200, { problem });
      }
      if (body.status !== "published" && body.status !== "rejected") {`,
  "OJ lifecycle route",
);
server = replaceOnce(
  server,
  `      const body = await readJson(request);
      const settings = await database.getServerSettings();`,
  `      const body = await readJson(request);
      if (validQuestId(body.questId) && !(await ensureQuestRuleAccess(player.id, body.questId))) {
        throw new ApiError(403, "QUEST_UNLOCK_RULE_NOT_MET", { questId: body.questId });
      }
      const settings = await database.getServerSettings();`,
  "judge unlock rule",
);
server = replaceOnce(
  server,
  `    if (error instanceof ApiError) {`,
  `    if (error instanceof LearningSystemError) {
      return json(response, error.status, { error: error.code, ...error.details });
    }
    if (error instanceof ApiError) {`,
  "learning error handling",
);
server = replaceOnce(
  server,
  `  await database.close();
  process.exit(0);`,
  `  await Promise.all([database.close(), closeLearningSystem()]);
  process.exit(0);`,
  "learning shutdown",
);

// Mainline rich statements are stored as validated documents on every admin save.
server = replaceOnce(
  server,
  `  if (!story.length || !guidance.length) {
    throw new ApiError(400, "QUEST_GUIDANCE_REQUIRED");
  }
  return {`,
  `  if (!story.length || !guidance.length) {
    throw new ApiError(400, "QUEST_GUIDANCE_REQUIRED");
  }
  let richStatement;
  try {
    const content = typeof problem.statement === "string" && problem.statement.trim()
      ? problem.statement
      : JSON.stringify({
          type: "doc",
          content: story.map((paragraph) => ({
            type: "paragraph",
            content: [{ type: "text", text: paragraph }],
          })),
        });
    richStatement = validateEditorialContent(content, "tiptap-json-v1");
  } catch (error) {
    if (error instanceof EditorialContentError) throw new ApiError(400, error.code);
    throw error;
  }
  return {`,
  "mainline rich statement validation",
);
server = replaceOnce(
  server,
  `      story,
      guidance,
      input: boundedText(problem.input, 4000),`,
  `      story,
      guidance,
      statement: richStatement.content,
      statementFormat: richStatement.contentFormat,
      input: boundedText(problem.input, 4000),`,
  "mainline statement fields",
);
await write("services/api/src/server.mjs", server);

// Rich editor can load and switch existing documents.
let richEditor = await read("components/editorial-rich-text.tsx");
richEditor = richEditor.replace(
  'import { useEffect, useMemo, useState } from "react";',
  'import { useEffect, useMemo, useRef, useState } from "react";',
);
richEditor = replaceOnce(
  richEditor,
  `export function EditorialComposer({
  locale, disabled, onChange,
}: {
  locale: Locale;
  disabled: boolean;
  onChange: (content: string, count: number, tooLarge: boolean) => void;
}) {`,
  `export function EditorialComposer({
  locale,
  disabled,
  onChange,
  initialContent = emptyEditorialDocument,
  initialContentFormat = "tiptap-json-v1",
}: {
  locale: Locale;
  disabled: boolean;
  onChange: (content: string, count: number, tooLarge: boolean) => void;
  initialContent?: string;
  initialContentFormat?: EditorialContentFormat;
}) {`,
  "editor initial props",
);
richEditor = replaceOnce(
  richEditor,
  `  const [linkUrl, setLinkUrl] = useState("");

  const editor = useEditor({`,
  `  const [linkUrl, setLinkUrl] = useState("");
  const initialKey = useRef(initialContentFormat + ":" + initialContent);
  const initialDocument = useMemo(
    () => parseDocument(initialContent, initialContentFormat),
    [initialContent, initialContentFormat],
  );

  const editor = useEditor({`,
  "editor initial document",
);
richEditor = richEditor.replace(
  "    content: JSON.parse(emptyEditorialDocument),",
  "    content: initialDocument,",
);
richEditor = replaceOnce(
  richEditor,
  `  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);`,
  `  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) return;
    const nextKey = initialContentFormat + ":" + initialContent;
    if (initialKey.current === nextKey) return;
    initialKey.current = nextKey;
    editor.commands.setContent(initialDocument, { emitUpdate: false });
  }, [editor, initialContent, initialContentFormat, initialDocument]);`,
  "editor document synchronization",
);
await write("components/editorial-rich-text.tsx", richEditor);

let quests = await read("lib/quests.ts");
quests = replaceOnce(
  quests,
  `  story: string[];
  guidance: string[];`,
  `  story: string[];
  guidance: string[];
  statement?: string;
  statementFormat?: "tiptap-json-v1";`,
  "quest statement type",
);
await write("lib/quests.ts", quests);

let admin = await read("components/admin-console.tsx");
admin = admin.replace(
  'import { EditorialRichText } from "@/components/editorial-rich-text";',
  'import { EditorialComposer, EditorialRichText, emptyEditorialDocument } from "@/components/editorial-rich-text";',
);
admin = replaceOnce(
  admin,
  `<p className="admin-section-label">{copy.publicFields}</p>
                    <div className="admin-form-grid">`,
  `<p className="admin-section-label">{copy.publicFields}</p>
                    <div className="admin-mainline-rich-editor">
                      <EditorialComposer
                        key={questDraft.id}
                        locale={locale}
                        disabled={false}
                        initialContent={questDraft.problem.statement ?? emptyEditorialDocument}
                        initialContentFormat="tiptap-json-v1"
                        onChange={(statement, _count, tooLarge) => {
                          if (tooLarge) return;
                          setQuestDraft({
                            ...questDraft,
                            problem: {
                              ...questDraft.problem!,
                              statement,
                              statementFormat: "tiptap-json-v1",
                            },
                          });
                        }}
                      />
                    </div>
                    <div className="admin-form-grid">`,
  "mainline editor",
);
await write("components/admin-console.tsx", admin);

let mission = await read("components/mission-terminal.tsx");
mission = mission.replace(
  'import { QuestPrologue } from "@/components/quest-prologue";',
  'import { QuestPrologue } from "@/components/quest-prologue";\nimport { EditorialRichText } from "@/components/editorial-rich-text";',
);
mission = replaceOnce(
  mission,
  `            {problem.story.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}`,
  `            <EditorialRichText
              content={problem.statement ?? JSON.stringify({
                type: "doc",
                content: problem.story.map((paragraph) => ({
                  type: "paragraph",
                  content: [{ type: "text", text: paragraph }],
                })),
              })}
              contentFormat="tiptap-json-v1"
            />`,
  "mission rich statement",
);
await write("components/mission-terminal.tsx", mission);

for (const file of Object.keys(generatedFiles)) await writeGenerated(file);

const extraCss = `
/* Canonical rich OJ and mainline authoring */
.oj-rich-statement-editor,.admin-mainline-rich-editor{margin:24px 0;padding:16px;border:2px solid var(--ink);background:var(--paper-deep)}
.oj-tag-group{margin-top:14px;padding-top:12px;border-top:1px dashed var(--ink)}
.oj-tag-group h4{margin:0 0 8px;font-size:10px}
.oj-status{display:inline-block;padding:4px 7px;color:var(--green);background:var(--ink);font-size:9px;font-weight:900}
.oj-status--rejected,.oj-status--deleted{color:#fff;background:#9c314e}.oj-status--archived{color:#151515;background:#f1e3b8}
.oj-private-actions{display:flex;gap:8px;flex-wrap:wrap}.oj-private-actions button,.oj-review-actions button{border:1px solid var(--ink);padding:7px 9px;font:900 9px inherit;cursor:pointer}
.oj-private-actions .is-danger,.oj-review-actions .is-reject{color:#fff;background:#9c314e}.oj-review-actions .is-approve{color:#fff;background:#087347}
.oj-review-statement{margin:16px 0;padding:16px;border:1px solid var(--ink);background:#faf8f2}
.editorial-composer{border:1px solid var(--ink);background:#fff}.editorial-composer__toolbar{display:flex;gap:5px;flex-wrap:wrap;padding:8px;border-bottom:1px solid var(--ink);background:var(--paper-deep)}
`;
await write("app/globals.css", `${await read("app/globals.css")}\n${extraCss}`);

console.log("AlgoQuest cleanup transformations completed.");
