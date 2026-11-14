// Plain-language story text per site and language (en / ru / tg).
// Everything a visitor reads about "why" lives here, so adding a site means adding one entry.
// Unknown sites fall back to GENERIC; missing languages fall back to English.

// Why some real changes do NOT show up in the radar picture (the challenge asks for this too).
const NOT_SEEN = {
  en: [
    ["Wind", "On a windy day ripples make water rough, the echo gets stronger, and part of the lake can vanish from the radar map."],
    ["Steep walls", "A slope facing away from the radar lies in radar shadow and looks dark, like water. A slope facing the radar folds over the shore and hides it. That is why the lake outline also uses a height limit from an elevation map."],
    ["Small moves", "One radar pixel here is 60 m wide. A shoreline that moves less than that cannot be seen."],
    ["Flooded trees", "Water under trees or bushes does not look dark: the signal bounces off the water and then the trunks straight back, so flooded forest looks very bright (NASA calls this double bounce)."],
  ],
  ru: [
    ["Ветер", "В ветреный день рябь делает воду шероховатой, эхо усиливается, и часть озера может пропасть с радарной карты."],
    ["Крутые склоны", "Склон, обращённый от радара, попадает в радарную тень и выглядит тёмным, как вода. Склон, обращённый к радару, «наваливается» на берег и скрывает его. Поэтому контур озера дополнительно ограничен по высоте с помощью карты высот."],
    ["Малые сдвиги", "Один радарный пиксель здесь шириной 60 м. Сдвиг берега меньше этого увидеть нельзя."],
    ["Затопленные деревья", "Вода под деревьями или кустами не выглядит тёмной: сигнал отражается от воды, затем от стволов и прямо возвращается, поэтому затопленный лес выглядит очень светлым (в NASA это называют двойным отражением)."],
  ],
  tg: [
    ["Шамол", "Дар рӯзи шамолдор мавҷҳо обро ноҳамвор мекунанд, акси садо қавӣ мешавад ва қисми кӯл метавонад аз харитаи радар гум шавад."],
    ["Нишебиҳои тез", "Нишебие, ки пушт ба радар аст, дар сояи радар мемонад ва мисли об торик менамояд. Нишебие, ки рӯ ба радар аст, ба болои соҳил «меафтад» ва онро пинҳон мекунад. Барои ҳамин контури кӯл бо харитаи баландӣ низ маҳдуд карда мешавад."],
    ["Ҳаракатҳои хурд", "Як пиксели радар дар ин ҷо 60 м паҳно дорад. Соҳиле, ки камтар аз ин ҷой иваз мекунад, дида намешавад."],
    ["Дарахтони зериобмонда", "Оби зери дарахт ё бутта торик наменамояд: сигнал аз об, баъд аз танаҳо рост бармегардад, бинобар ин ҷангали зериобмонда хеле равшан менамояд (NASA инро инъикоси дугона меномад)."],
  ],
};

// What else NISAR can do (L-band and S-band radar, every 12 days, day and night, through cloud).
const FUTURE = {
  en: [
    ["🌊", "Floods", "Radar sees water during the storm itself, under the clouds. New dark areas are flooded land, mapped within days for rescue teams. Flooded forest turns very bright, so water is found even under trees."],
    ["⛰️", "Slow landslides", "By comparing the radar wave itself between two passes, NISAR can measure ground movement of a few centimetres. Slopes that creep before they fail could be flagged early."],
    ["🧊", "Glaciers", "Pamir glaciers feed the rivers that give water to millions of people across Central Asia. NISAR can track how fast they flow, in every season. Wet snow sends back a weaker echo than dry snow, so radar also shows when the melt begins."],
    ["🌾", "Farms and soil moisture", "The echo changes with wet soil and growing crops, which helps plan irrigation and forecast harvests."],
    ["🏗️", "Dams, roads and towns", "The same centimetre-scale measurement shows ground that is sinking or a structure that is settling. Pass after pass, NISAR builds a normal picture of a dam, so unusual movement stands out."],
    ["🌍", "Earthquakes", "After an earthquake NISAR can map how far the ground shifted, over a whole region at once. Filling a big reservoir can also trigger small earthquakes, so the ground around a lake is worth watching."],
    ["🔥", "Wildfires", "The HV channel echoes off leaves and branches. Where a fire burned the plants, HV drops, so burn scars can be mapped even through smoke."],
  ],
  ru: [
    ["🌊", "Паводки", "Радар видит воду прямо во время непогоды, под облаками. Новые тёмные области — это затопленная земля; карту можно получить за считанные дни для спасателей. Затопленный лес становится очень светлым, поэтому воду находят даже под деревьями."],
    ["⛰️", "Медленные оползни", "Сравнивая саму радарную волну между двумя пролётами, NISAR может измерить сдвиг грунта в несколько сантиметров. Склоны, которые медленно ползут перед обрушением, можно заметить заранее."],
    ["🧊", "Ледники", "Ледники Памира питают реки, которые дают воду миллионам людей в Центральной Азии. NISAR может следить, как быстро они текут, в любое время года. Мокрый снег даёт более слабое эхо, чем сухой, поэтому радар показывает и начало таяния."],
    ["🌾", "Поля и влажность почвы", "Эхо меняется от влажной почвы и растущих посевов. Это помогает планировать полив и прогнозировать урожай."],
    ["🏗️", "Плотины, дороги и города", "То же сантиметровое измерение показывает проседающий грунт или оседающее сооружение. Пролёт за пролётом NISAR составляет обычную картину плотины, и необычное движение сразу заметно."],
    ["🌍", "Землетрясения", "После землетрясения NISAR может сразу для целого региона показать, насколько сдвинулась земля. Наполнение большого водохранилища тоже может вызывать слабые землетрясения, поэтому за землёй вокруг озера стоит следить."],
    ["🔥", "Лесные пожары", "Канал HV отражается от листьев и веток. Там, где огонь сжёг растения, HV падает, поэтому гари можно нанести на карту даже сквозь дым."],
  ],
  tg: [
    ["🌊", "Обхезӣ", "Радар обро дар худи вақти тӯфон, дар зери абр мебинад. Ҷойҳои нави торик замини зериобмонда мебошанд; харитаи онҳоро дар чанд рӯз барои наҷотдиҳандагон тайёр кардан мумкин аст. Ҷангали зериобмонда хеле равшан мешавад, бинобар ин об ҳатто дар зери дарахтон ёфт мешавад."],
    ["⛰️", "Ярчҳои оҳиста", "NISAR худи мавҷи радарро байни ду гузариш муқоиса карда, ҳаракати заминро то чанд сантиметр чен карда метавонад. Нишебиҳое, ки пеш аз фурӯ рафтан оҳиста мелағжанд, пешакӣ муайян кардан мумкин аст."],
    ["🧊", "Пиряхҳо", "Пиряхҳои Помир дарёҳоеро ғизо медиҳанд, ки ба миллионҳо одамони Осиёи Марказӣ об медиҳанд. NISAR дар ҳар фасли сол пайгирӣ карда метавонад, ки онҳо чӣ қадар тез ҳаракат мекунанд. Барфи тар нисбат ба барфи хушк акси садои сусттар медиҳад, бинобар ин радар оғози обшавиро низ нишон медиҳад."],
    ["🌾", "Киштзор ва намии хок", "Акси садо аз хоки намнок ва зироати сабзанда тағйир меёбад. Ин барои банақшагирии обёрӣ ва пешгӯии ҳосил кӯмак мекунад."],
    ["🏗️", "Сарбандҳо, роҳҳо ва шаҳрҳо", "Ҳамон ченаки сантиметрӣ замини фурӯравандаро ё иншооти нишасторо нишон медиҳад. Гузариш ба гузариш NISAR тасвири муқаррарии сарбандро месозад ва ҳаракати ғайриоддӣ дарҳол намоён мешавад."],
    ["🌍", "Зилзила", "Пас аз зилзила NISAR метавонад якбора барои тамоми минтақа нишон диҳад, ки замин чӣ қадар ҷой иваз кард. Пур кардани обанбори калон низ метавонад зилзилаҳои суст ба вуҷуд орад, бинобар ин замини атрофи кӯлро назорат кардан меарзад."],
    ["🔥", "Сӯхтор", "Канали HV аз барг ва шохаҳо бармегардад. Дар ҷое ки оташ растаниҳоро сӯзонд, HV паст мешавад, бинобар ин ҷойҳои сӯхтаро ҳатто аз байни дуд ба харита гузоштан мумкин аст."],
  ],
};

const GENERIC = {
  en: {
    country: "",
    welcomeTitle: "Watch the ground change, seen from space",
    welcome: (name) => `Every 12 days a NASA–ISRO radar satellite called NISAR flies over ${name}. Radar sees the ground at night and through clouds.`,
    intro: (name) => `${name} seen by the NISAR radar satellite.`,
    why: "Water spreads when more flows in than flows out: after snow melt, rain, or when a dam holds the river back.",
    matters: "Open satellite measurements let anyone follow how water, and the land around it, is changing.",
    hotspot: "This is where the water surface grew the most between the two dates.",
    tourWhy: "Water spreads when more flows in than flows out. A long radar record shows the rhythm, season after season.",
    areaNote: "", human: "", personal: "", caveats: [],
  },
  ru: {
    country: "",
    welcomeTitle: "Смотрите, как меняется земля, из космоса",
    welcome: (name) => `Каждые 12 дней радарный спутник NASA–ISRO под названием NISAR пролетает над объектом «${name}». Радар видит землю ночью и сквозь облака.`,
    intro: (name) => `${name} глазами радарного спутника NISAR.`,
    why: "Вода разливается, когда притекает больше, чем утекает: после таяния снега, дождей или когда плотина задерживает реку.",
    matters: "Открытые спутниковые измерения позволяют каждому следить, как меняется вода и земля вокруг неё.",
    hotspot: "Здесь площадь воды между двумя датами выросла больше всего.",
    tourWhy: "Вода разливается, когда притекает больше, чем утекает. Длинный ряд радарных снимков показывает этот ритм из сезона в сезон.",
    areaNote: "", human: "", personal: "", caveats: [],
  },
  tg: {
    country: "",
    welcomeTitle: "Тағйири заминро аз кайҳон бинед",
    welcome: (name) => `Ҳар 12 рӯз моҳвораи радарии NASA–ISRO бо номи NISAR аз болои «${name}» мегузарад. Радар заминро шабона ва аз байни абр мебинад.`,
    intro: (name) => `${name} аз назари моҳвораи радарии NISAR.`,
    why: "Об вақте паҳн мешавад, ки бештар ворид шавад аз он ки мебарояд: пас аз обшавии барф, борон ё вақте ки сарбанд дарёро нигоҳ медорад.",
    matters: "Ченакҳои кушодаи моҳвораӣ ба ҳар кас имкон медиҳанд, ки тағйири об ва замини атрофи онро пайгирӣ кунад.",
    hotspot: "Дар ин ҷо масоҳати об байни ду сана аз ҳама бештар калон шуд.",
    tourWhy: "Об вақте паҳн мешавад, ки бештар ворид шавад аз он ки мебарояд. Силсилаи дарози аксҳои радар ин ритмро фасл ба фасл нишон медиҳад.",
    areaNote: "", human: "", personal: "", caveats: [],
  },
};

export const STORIES = {
  vakhsh_cascade: {
    en: {
      name: "Rogun and Nurek",
      leadName: "the two lakes together",
      levelAt: "at Rogun",
      insarNote: "Look for the two speckled shapes: they are Nurek and Rogun.",
      region: "Vakhsh river, Tajikistan",
      country: "Tajikistan",
      welcomeTitle: "Two lakes on one river, seen from space",
      welcome: () =>
        "On the Vakhsh River in Tajikistan two giant dams stand one after the other: Nurek, finished in 1980, and Rogun upstream, still being built. Every 12 days the NASA–ISRO radar satellite NISAR flies over both lakes at once and measures them, at night and through clouds.",
      intro: () =>
        "The Vakhsh flows from the Pamir and Alay mountains. Nurek dam (300 m tall, the tallest dam in the world until 2013) makes the largest share of Tajikistan's electricity (between half and 70%, depending on the source). Upstream, Rogun is being built to become even taller (planned 335 m). One radar picture shows both lakes: the big one in the south-west is Nurek, the long thin one in the north-east is Rogun.",
      why: "Summer is when the Vakhsh carries the most water: snow and glaciers in the Pamir melt. Both lakes store this water. Nurek fills back up after being drawn down for winter electricity, and Rogun rises a little more each time its dam wall gets higher. In winter the water goes through the turbines, when homes need power most.",
      matters:
        "This one river makes most of the electricity in Tajikistan, and its water continues downstream to fields in Uzbekistan and Turkmenistan. How much is held back, and when, matters to millions of people. Open satellite measurements let anyone follow both lakes, independently and at the same moment.",
      hotspot:
        "This is where the water spread the most. Where the shore is gentle, a few metres of extra water level cover a wide strip of ground; in steep canyons the same rise barely shows from above.",
      tourWhy:
        "Summer melt from the Pamir glaciers fills both lakes. Nurek refills after winter, and Rogun rises a step each time its dam wall grows. In winter the stored water is turned into electricity.",
      areaNote: "Each lake is measured separately from the same radar passes.",
      human:
        "Both lakes are made by people. The dams hold back the Vakhsh to make electricity: Nurek since the 1970s, Rogun now. Building Rogun means resettling up to 42,000 people from the valley that is now filling with water.",
      personal:
        "We are a team from Tajikistan. The Vakhsh is our river: its water lights our homes in winter and waters the fields downstream. These are our mountains, so we built this page for everyone here, not only for scientists.",
      c2title: "People made these lakes",
      actions: [
        ["💧", "Water and energy managers", "Follow how full Nurek and Rogun are every 12 days, at night and through cloud, and compare it with the planned filling and the winter release."],
        ["🏛️", "Decision-makers", "The Rogun dam shows no movement beyond about ±3 cm, but one slope is creeping. Send a team to look at it and keep watching it with each new pass."],
        ["🔬", "Scientists", "Test the water-level estimate against gauge readings, and confirm the creeping slope from a second orbit."],
        ["🎓", "Teachers and the public", "Use the before/after slider to show how a reservoir fills, and why winter electricity depends on summer water."],
      ],
      check: "We compared our pictures with ASF's own browse images of the same NISAR passes (180 m). They line up with no shift (r = 0.74 for HH, 0.75 for HV on 13 Oct 2026). Lake areas measured independently from ASF's pictures for September–October agree with ours to within 1–7% for Nurek; Rogun's narrow canyon comes out about 10% smaller at 180 m. ASF's pictures of the two newer VALIDATED passes (25 Oct and 6 Nov) show both lakes about the same size.",
      caveats: [
        "Water level is an estimate for Rogun only (about ±10 m): it is the height at which the valley map from before the filling floods the same area.",
        "Wind can roughen the water so the radar misses part of a lake on some dates.",
        "The river between the two lakes is too narrow to measure at 60 m and is not counted.",
        "Checked twice: separate runs gave Nurek 72.1 → 88.1 km² (its own frame) and Rogun 15.1 → 19.9 km², level about 1118 → 1128 m, from a different orbit (track 84). Two orbits, the same result.",
      ],
    },
    ru: {
      name: "Рогун и Нурек",
      leadName: "общее зеркало воды двух озёр",
      levelAt: "у Рогуна",
      insarNote: "Найдите два пятна «ряби»: это Нурек и Рогун.",
      region: "река Вахш, Таджикистан",
      country: "Таджикистан",
      welcomeTitle: "Два озера на одной реке, из космоса",
      welcome: () =>
        "На реке Вахш в Таджикистане одна за другой стоят две гигантские плотины: Нурек, построенный в 1980 году, и выше по течению Рогун, который ещё строится. Каждые 12 дней радарный спутник NASA–ISRO NISAR пролетает сразу над обоими озёрами и измеряет их, ночью и сквозь облака.",
      intro: () =>
        "Вахш течёт с гор Памира и Алая. Нурекская плотина (300 м, самая высокая плотина в мире до 2013 года) даёт самую большую долю электричества Таджикистана (от половины до 70%, по разным источникам). Выше по течению строится Рогун, который должен стать ещё выше (по плану 335 м). На одном радарном снимке видны оба озера: большое на юго-западе — Нурек, длинное и узкое на северо-востоке — Рогун.",
      why: "Больше всего воды Вахш несёт летом, когда тают снега и ледники Памира. Оба озера запасают эту воду. Нурек снова наполняется после того, как зимой его спускали ради электричества, а Рогун поднимается ещё немного каждый раз, когда растёт стена плотины. Зимой вода идёт через турбины, когда домам больше всего нужен свет.",
      matters:
        "Эта одна река даёт большую часть электричества Таджикистана, а её вода течёт дальше, к полям Узбекистана и Туркменистана. Сколько воды задерживается и когда — важно для миллионов людей. Открытые спутниковые измерения позволяют каждому следить за обоими озёрами независимо и в один и тот же момент.",
      hotspot:
        "Здесь вода разлилась сильнее всего. Где берег пологий, несколько лишних метров уровня заливают широкую полосу земли; в крутых каньонах такой же подъём сверху почти не заметен.",
      tourWhy:
        "Летнее таяние ледников Памира наполняет оба озера. Нурек наполняется после зимы, а Рогун поднимается на ступень каждый раз, когда растёт стена плотины. Зимой запасённая вода превращается в электричество.",
      areaNote: "Каждое озеро измерено отдельно по одним и тем же радарным пролётам.",
      human:
        "Оба озера созданы людьми. Плотины удерживают Вахш, чтобы давать электричество: Нурек с 1970-х годов, Рогун сейчас. Ради Рогуна из долины, которая теперь заполняется водой, переселяют до 42 000 человек.",
      personal:
        "Мы — команда из Таджикистана. Вахш — наша река: её вода освещает наши дома зимой и орошает поля ниже по течению. Это наши горы, поэтому мы сделали эту страницу для всех, кто здесь живёт, а не только для учёных.",
      c2title: "Эти озёра создали люди",
      actions: [
        ["💧", "Управляющие водой и энергией", "Следите, насколько заполнены Нурек и Рогун, каждые 12 дней, ночью и сквозь облака, и сравнивайте с планом наполнения и зимнего сброса."],
        ["🏛️", "Те, кто принимает решения", "Плотина Рогун не показывает движения больше примерно ±3 см, но один склон сползает. Отправьте специалистов осмотреть его и следите за ним с каждым новым пролётом."],
        ["🔬", "Учёные", "Проверьте оценку уровня воды по данным гидропостов и подтвердите сползающий склон со второй орбиты."],
        ["🎓", "Учителя и все желающие", "Покажите с помощью слайдера «до/после», как наполняется водохранилище и почему зимнее электричество зависит от летней воды."],
      ],
      check: "Мы сравнили наши снимки с собственными обзорными снимками ASF тех же пролётов NISAR (180 м). Они совпадают без сдвига (r = 0,74 для HH, 0,75 для HV на 13 октября 2026 г.). Площади озёр, независимо измеренные по снимкам ASF за сентябрь–октябрь, для Нурека отличаются от наших на 1–7%; узкий каньон Рогуна при 180 м выходит примерно на 10% меньше. На снимках ASF двух более новых пролётов VALIDATED (25 октября и 6 ноября) оба озера примерно того же размера.",
      caveats: [
        "Уровень воды — оценка только для Рогуна (примерно ±10 м): это высота, при которой карта долины до заполнения затопилась бы на ту же площадь.",
        "Ветер делает воду шероховатой, и в некоторые даты радар пропускает часть озера.",
        "Река между двумя озёрами слишком узкая для пикселя 60 м и не учитывается.",
        "Проверено дважды: отдельные расчёты дали Нурек 72,1 → 88,1 км² (своя рамка) и Рогун 15,1 → 19,9 км², уровень примерно 1118 → 1128 м, с другой орбиты (трек 84). Две орбиты — один результат.",
      ],
    },
    tg: {
      name: "Роғун ва Норак",
      leadName: "масоҳати ҳарду кӯл",
      levelAt: "дар Роғун",
      insarNote: "Ду доғи «пурғавғо»-ро ёбед: инҳо Норак ва Роғун мебошанд.",
      region: "дарёи Вахш, Тоҷикистон",
      country: "Тоҷикистон",
      welcomeTitle: "Ду кӯл дар як дарё, аз кайҳон",
      welcome: () =>
        "Дар дарёи Вахш дар Тоҷикистон ду сарбанди азим паси ҳам истодаанд: Норак, ки соли 1980 сохта шуд, ва болотар аз он Роғун, ки ҳанӯз сохта мешавад. Ҳар 12 рӯз моҳвораи радарии NASA–ISRO бо номи NISAR якбора аз болои ҳарду кӯл гузашта, онҳоро шабона ва аз байни абр чен мекунад.",
      intro: () =>
        "Вахш аз кӯҳҳои Помир ва Олой ҷорӣ мешавад. Сарбанди Норак (300 м, то соли 2013 баландтарин сарбанди ҷаҳон) калонтарин ҳиссаи барқи Тоҷикистонро истеҳсол мекунад (аз нисф то 70%, вобаста ба манбаъ). Болотар Роғун сохта мешавад, ки бояд боз ҳам баландтар шавад (тибқи нақша 335 м). Дар як акси радар ҳарду кӯл намоёнанд: кӯли калон дар ҷанубу ғарб Норак аст, кӯли дарозу борик дар шимолу шарқ Роғун.",
      why: "Вахш дар тобистон, вақте ки барф ва пиряхҳои Помир об мешаванд, аз ҳама бештар об меорад. Ҳарду кӯл ин обро захира мекунанд. Норак пас аз он ки зимистон барои барқ холӣ карда шуд, боз пур мешавад, Роғун бошад ҳар дафъа, ки девори сарбанд баландтар мешавад, каме боло меравад. Зимистон об аз турбинаҳо мегузарад, вақте ки хонаҳо ба барқ аз ҳама бештар ниёз доранд.",
      matters:
        "Ҳамин як дарё қисми зиёди барқи Тоҷикистонро медиҳад ва оби он ба киштзорҳои Ӯзбекистон ва Туркманистон меравад. Чӣ қадар об ва кай нигоҳ дошта мешавад, барои миллионҳо одам муҳим аст. Ченакҳои кушодаи моҳвораӣ ба ҳар кас имкон медиҳанд, ки ҳарду кӯлро мустақилона ва дар як вақт пайгирӣ кунад.",
      hotspot:
        "Дар ин ҷо об аз ҳама бештар паҳн шуд. Дар ҷое ки соҳил ҳамвор аст, чанд метри иловагии сатҳи об рахи васеи заминро мепӯшонад; дар дараҳои тез ҳамин гуна баландшавӣ аз боло қариб намоён нест.",
      tourWhy:
        "Обшавии тобистонаи пиряхҳои Помир ҳарду кӯлро пур мекунад. Норак пас аз зимистон пур мешавад, Роғун бошад ҳар дафъа, ки девори сарбанд баланд мешавад, як зина боло меравад. Зимистон оби захирашуда ба барқ табдил меёбад.",
      areaNote: "Ҳар кӯл аз ҳамон гузаришҳои радар алоҳида чен карда шудааст.",
      human:
        "Ҳарду кӯлро одамон сохтаанд. Сарбандҳо Вахшро барои истеҳсоли барқ нигоҳ медоранд: Норак аз солҳои 1970, Роғун ҳоло. Барои Роғун аз водие, ки акнун бо об пур мешавад, то 42 000 нафар кӯчонида мешаванд.",
      personal:
        "Мо дастае аз Тоҷикистон ҳастем. Вахш дарёи мост: оби он зимистон хонаҳои моро равшан мекунад ва киштзорҳои поёнобро обёрӣ менамояд. Ин кӯҳҳои мост, бинобар ин мо ин саҳифаро на танҳо барои олимон, балки барои ҳамаи сокинони ин ҷо сохтем.",
      c2title: "Ин кӯлҳоро одамон сохтаанд",
      actions: [
        ["💧", "Идоракунандагони об ва нерӯ", "Ҳар 12 рӯз, шабона ва аз байни абр пайгирӣ кунед, ки Норак ва Роғун чӣ қадар пур ҳастанд, ва онро бо нақшаи пуркунӣ ва раҳоии зимистона муқоиса кунед."],
        ["🏛️", "Қарорқабулкунандагон", "Сарбанди Роғун ҳаракати зиёдтар аз тақрибан ±3 см нишон намедиҳад, аммо як нишеб мехазад. Мутахассисонро барои дидани он фиристед ва бо ҳар гузариши нав онро назорат кунед."],
        ["🔬", "Олимон", "Баҳои сатҳи обро бо маълумоти постҳои гидрологӣ санҷед ва нишеби хазандаро аз мадори дуюм тасдиқ кунед."],
        ["🎓", "Омӯзгорон ва ҳама", "Бо слайдери «пеш/пас» нишон диҳед, ки обанбор чӣ тавр пур мешавад ва чаро барқи зимистон аз оби тобистон вобаста аст."],
      ],
      check: "Мо аксҳои худро бо аксҳои умумии худи ASF аз ҳамон гузаришҳои NISAR (180 м) муқоиса кардем. Онҳо бе ягон лағжиш мувофиқ меоянд (r = 0,74 барои HH, 0,75 барои HV дар 13 октябри 2026). Масоҳати кӯлҳо, ки мустақилона аз аксҳои ASF барои сентябр–октябр чен карда шуд, барои Норак аз рақамҳои мо ҳамагӣ 1–7% фарқ мекунад; дараи танги Роғун бо 180 м тақрибан 10% хурдтар мебарояд. Дар аксҳои ASF аз ду гузариши навтари VALIDATED (25 октябр ва 6 ноябр) ҳарду кӯл тақрибан ҳамон андоза мебошанд.",
      caveats: [
        "Сатҳи об танҳо барои Роғун тахминӣ аст (тақрибан ±10 м): ин баландиест, ки дар он харитаи водӣ пеш аз пуршавӣ ҳамон масоҳатро зери об мегузошт.",
        "Шамол обро ноҳамвор мекунад ва дар баъзе санаҳо радар қисми кӯлро намебинад.",
        "Дарёи байни ду кӯл барои пиксели 60 м хеле танг аст ва ҳисоб карда намешавад.",
        "Ду бор санҷида шуд: ҳисобҳои алоҳида Норакро 72,1 → 88,1 км² (чаҳорчӯбаи худаш) ва Роғунро 15,1 → 19,9 км², сатҳи об тақрибан 1118 → 1128 м, аз мадори дигар (траки 84) нишон доданд. Ду мадор — як натиҷа.",
      ],
    },
    // where the dam facts in this story come from (shown in "About the data")
    facts: "Nurek: 300 m, built 1961–1980, first power in 1972 (Structurae, Wikipedia); share of electricity (World Bank, ADB). Rogun: planned 335 m, up to 42,000 people resettled (World Bank expert panel 2014; AIIB project documents).",
    media: [],
  },
  vakhsh: {
    en: {
      name: "Vakhsh valley farms",
      region: "Khatlon, Tajikistan",
      country: "Tajikistan",
      welcomeTitle: "Watch a valley of crops grow, seen from space",
      welcome: () =>
        "Below the Nurek dam the Vakhsh River waters a wide, flat valley in Khatlon, southern Tajikistan. Most of it is fields, mainly cotton. Every 12 days the NASA–ISRO radar satellite NISAR flies over and measures how the plants grow, at night and through clouds.",
      intro: () =>
        "This picture covers about 40 × 40 km of the Vakhsh valley. The flat land in the west and the middle is farmland: about 700 km² that is almost perfectly level. The hills in the east are not counted. The water for these fields comes from the Vakhsh, after it has passed through the Nurek lake shown on our other Tajik page.",
      tourIntro:
        "In the colour radar picture green means plants: the HV echo is strongest where leaves and stems scatter the signal. The flat green valley is farmland; the hills to the east are bare and look purple or grey.",
      why: "In June young cotton plants are small and most of the field is bare soil. By September every row is a dense bush of leaves, stems and bolls. Leaves and stems scatter the radar wave in all directions and turn part of it sideways; that turned part is the HV echo. More plant means more HV. When a field is cleared after the harvest, HV falls again.",
      tourWhy:
        "Leaves and stems scatter the radar wave in all directions and turn part of it sideways: that is the HV echo. The bigger and denser the plants, the stronger HV. That is why NASA uses HV for vegetation and HH for water.",
      matters:
        "Many families in Khatlon live from these fields, and every field depends on water from the Vakhsh. A radar that sees crops through clouds every 12 days can show which areas are growing well, help plan irrigation and show when the harvest really happens, openly and for anyone.",
      human:
        "These fields are worked by families from the villages of the valley. Cotton here is picked by hand from September to November, and the plants stay standing in the field while it is picked.",
      personal:
        "We are a team from Tajikistan. After watching the Vakhsh fill two lakes, we followed its water downstream to the fields it irrigates. Here the change is slow and green, not sudden: a whole valley growing over one summer.",
      c2title: "Who works this land",
      actions: [
        ["🌾", "Farm and irrigation managers", "See which areas grew well and which stayed flat, to target water and field visits."],
        ["🏛️", "Decision-makers", "Follow the harvest across the whole valley, even under cloud, without waiting for field reports."],
        ["🔬", "Scientists", "Compare with field data to turn this test into a real crop map, and separate plant growth from wet soil."],
        ["🎓", "Teachers and the public", "Show how a radar «hears» plants grow: the green HV line climbs as the crops get bigger."],
      ],
      check: "We compared our pictures with ASF's own browse images of the same NISAR passes (180 m). They line up within about one pixel (r = 0.78 for HH, 0.82 for HV on 13 Oct 2026).",
      c1title: "Our valley, seen from space",
      notSeen: [
        ["Single fields", "One pixel is 60 m wide, so small plots blur together. We report the median of all the farmland, not each field."],
        ["Wet soil", "Watering a field makes the soil wetter and the HH echo stronger for a few days. Part of the HH rise can be irrigation, not plants."],
        ["Which crop", "Radar alone does not tell cotton from wheat or orchards. 'Mainly cotton' comes from what is known about the region, not from this map."],
        ["Hand picking", "Picking cotton by hand leaves the plants standing, so the radar sees little change until the stalks are cleared."],
      ],
      caveats: [
        "This is a test of an idea, not a crop map: 'farmland' here simply means flat land (slope under 2°) with a typical field echo.",
        "By 6 November between 28 and 54 km² (4–8%) show a big HV drop; on 13 October it was about 25 km². The range is wide because the two newest passes come from a newer data version that reads 0.2–0.6 dB lower, and a third of the higher number is single pixels. So the harvest may be starting to show, but we cannot say it doubled. These are candidates, not confirmed on the ground.",
        "The rise of about 1 dB is small but consistent: the middle half of all fields (the green band) rose together.",
        "There is no pass between 21 July and 14 August (the NISAR data gap).",
      ],
    },
    ru: {
      name: "Поля долины Вахша",
      region: "Хатлон, Таджикистан",
      country: "Таджикистан",
      welcomeTitle: "Смотрите из космоса, как растут посевы целой долины",
      welcome: () =>
        "Ниже Нурекской плотины река Вахш орошает широкую плоскую долину в Хатлоне, на юге Таджикистана. Большая её часть — поля, в основном хлопок. Каждые 12 дней радарный спутник NASA–ISRO NISAR пролетает над ними и измеряет, как растут растения, ночью и сквозь облака.",
      intro: () =>
        "Снимок охватывает около 40 × 40 км долины Вахша. Плоская земля на западе и в центре — поля: около 700 км² почти идеально ровной земли. Холмы на востоке не учитываются. Вода для этих полей приходит из Вахша, после того как прошла через Нурекское озеро с нашей другой таджикской страницы.",
      tourIntro:
        "На цветном радарном снимке зелёный цвет означает растения: эхо HV сильнее всего там, где листья и стебли рассеивают сигнал. Плоская зелёная долина — это поля; холмы на востоке голые и выглядят фиолетовыми или серыми.",
      why: "В июне молодые кусты хлопка маленькие, и большая часть поля — голая почва. К сентябрю каждый ряд превращается в густой куст из листьев, стеблей и коробочек. Листья и стебли рассеивают радарную волну во все стороны и поворачивают её часть вбок; эта повёрнутая часть и есть эхо HV. Больше растений — больше HV. Когда поле после сбора урожая расчищают, HV снова падает.",
      tourWhy:
        "Листья и стебли рассеивают радарную волну во все стороны и поворачивают её часть вбок: это и есть эхо HV. Чем больше и гуще растения, тем сильнее HV. Поэтому NASA использует HV для растительности, а HH — для воды.",
      matters:
        "Многие семьи в Хатлоне живут этими полями, и каждое поле зависит от воды Вахша. Радар, который каждые 12 дней видит посевы сквозь облака, может показать, где растения растут хорошо, помочь планировать полив и показать, когда на самом деле идёт сбор урожая — открыто и для всех.",
      human:
        "На этих полях работают семьи из сёл долины. Хлопок здесь собирают вручную с сентября по ноябрь, и пока его собирают, кусты остаются стоять в поле.",
      personal:
        "Мы — команда из Таджикистана. Посмотрев, как Вахш наполняет два озера, мы пошли за его водой вниз по течению, к полям, которые она орошает. Здесь изменение медленное и зелёное, а не внезапное: целая долина растёт за одно лето.",
      c2title: "Кто работает на этой земле",
      actions: [
        ["🌾", "Агрономы и службы орошения", "Смотрите, где посевы росли хорошо, а где почти не изменились, чтобы точнее направлять воду и выезды в поля."],
        ["🏛️", "Те, кто принимает решения", "Следите за уборкой урожая по всей долине, даже под облаками, не дожидаясь отчётов с полей."],
        ["🔬", "Учёные", "Сравните с полевыми данными, чтобы превратить эту проверку в настоящую карту посевов, и отделите рост растений от влажной почвы."],
        ["🎓", "Учителя и все желающие", "Покажите, как радар «слышит» рост растений: зелёная линия HV поднимается, когда посевы становятся больше."],
      ],
      check: "Мы сравнили наши снимки с собственными обзорными снимками ASF тех же пролётов NISAR (180 м). Они совпадают с точностью примерно до одного пикселя (r = 0,78 для HH, 0,82 для HV на 13 октября 2026 г.).",
      c1title: "Наша долина из космоса",
      notSeen: [
        ["Отдельные поля", "Один пиксель — 60 м, поэтому мелкие участки сливаются. Мы показываем медиану по всем полям, а не по каждому полю."],
        ["Мокрая почва", "Полив делает почву влажнее, и эхо HH на несколько дней усиливается. Часть роста HH может быть поливом, а не растениями."],
        ["Какая культура", "Сам по себе радар не отличает хлопок от пшеницы или садов. «В основном хлопок» — это то, что известно о регионе, а не вывод из этой карты."],
        ["Ручной сбор", "При ручном сборе хлопка кусты остаются стоять, поэтому радар почти не видит изменений, пока стебли не уберут."],
      ],
      caveats: [
        "Это проверка идеи, а не карта посевов: «поля» здесь — просто ровная земля (уклон меньше 2°) с типичным для поля эхом.",
        "К 6 ноября сильное падение HV показывают от 28 до 54 км² (4–8%); 13 октября было около 25 км². Разброс большой, потому что два последних пролёта взяты из более новой версии данных, которая даёт значения на 0,2–0,6 дБ ниже, а треть большего числа — одиночные пиксели. Возможно, уборка становится заметной, но сказать, что площадь удвоилась, нельзя. Это кандидаты, не подтверждённые на месте.",
        "Рост примерно на 1 дБ небольшой, но согласованный: средняя половина всех полей (зелёная полоса) росла вместе.",
        "С 21 июля по 14 августа пролётов нет (пробел в данных NISAR).",
      ],
    },
    tg: {
      name: "Киштзорҳои водии Вахш",
      region: "Хатлон, Тоҷикистон",
      country: "Тоҷикистон",
      welcomeTitle: "Аз кайҳон бинед, ки зироати як водӣ чӣ тавр мерӯяд",
      welcome: () =>
        "Поёнтар аз сарбанди Норак дарёи Вахш водии васеъ ва ҳамвореро дар Хатлон, дар ҷануби Тоҷикистон, обёрӣ мекунад. Қисми зиёди он киштзор, асосан пахта аст. Ҳар 12 рӯз моҳвораи радарии NASA–ISRO бо номи NISAR аз болои он гузашта, шабона ва аз байни абр чен мекунад, ки растаниҳо чӣ тавр мерӯянд.",
      intro: () =>
        "Ин акс тақрибан 40 × 40 км-и водии Вахшро фаро мегирад. Замини ҳамвор дар ғарб ва мобайн киштзор аст: тақрибан 700 км² замини қариб комилан ҳамвор. Теппаҳои шарқ ҳисоб карда намешаванд. Оби ин киштзорҳо аз Вахш меояд, пас аз он ки аз кӯли Норак, ки дар саҳифаи дигари тоҷикии мо нишон дода шудааст, мегузарад.",
      tourIntro:
        "Дар акси рангаи радар ранги сабз растаниро нишон медиҳад: акси садои HV дар ҷое аз ҳама қавӣ аст, ки барг ва поя сигналро пароканда мекунанд. Водии ҳамвори сабз киштзор аст; теппаҳои шарқ бараҳнаанд ва бунафш ё хокистарӣ менамоянд.",
      why: "Дар моҳи июн бутаҳои ҷавони пахта хурданд ва қисми зиёди майдон хоки бараҳна аст. То сентябр ҳар қатор ба бутаи зич аз барг, поя ва кӯрак табдил меёбад. Барг ва поя мавҷи радарро ба ҳар тараф пароканда мекунанд ва қисми онро ба паҳлӯ мегардонанд; ҳамин қисми гардонидашуда акси садои HV аст. Растании бештар, HV бештар. Вақте ки майдонро пас аз ҳосилғундорӣ тоза мекунанд, HV боз паст мешавад.",
      tourWhy:
        "Барг ва поя мавҷи радарро ба ҳар тараф пароканда мекунанд ва қисми онро ба паҳлӯ мегардонанд: ин акси садои HV аст. Ҳар қадар растанӣ калонтар ва зичтар бошад, HV ҳамон қадар қавӣ аст. Барои ҳамин NASA HV-ро барои растанӣ ва HH-ро барои об истифода мебарад.",
      matters:
        "Бисёр оилаҳо дар Хатлон аз ҳамин киштзорҳо рӯзӣ мебинанд ва ҳар майдон аз оби Вахш вобаста аст. Радаре, ки ҳар 12 рӯз зироатро аз байни абр мебинад, метавонад нишон диҳад, ки дар куҷо растанӣ хуб мерӯяд, ба банақшагирии обёрӣ кӯмак кунад ва нишон диҳад, ки ҳосилғундорӣ воқеан кай мегузарад — ошкоро ва барои ҳама.",
      human:
        "Дар ин киштзорҳо оилаҳо аз деҳаҳои водӣ кор мекунанд. Пахтаро дар ин ҷо аз сентябр то ноябр бо даст мечинанд ва дар вақти пахтачинӣ бутаҳо дар майдон истода мемонанд.",
      personal:
        "Мо дастае аз Тоҷикистон ҳастем. Пас аз дидани он ки Вахш ду кӯлро пур мекунад, мо аз паси оби он ба поён, ба киштзорҳое, ки он обёрӣ мекунад, рафтем. Дар ин ҷо тағйирот оҳиста ва сабз аст, на ногаҳонӣ: тамоми водӣ дар як тобистон мерӯяд.",
      c2title: "Кӣ дар ин замин кор мекунад",
      actions: [
        ["🌾", "Агрономҳо ва хадамоти обёрӣ", "Бинед, ки дар куҷо зироат хуб рӯид ва дар куҷо қариб тағйир наёфт, то обро ва сафарҳоро ба майдон дақиқтар равона кунед."],
        ["🏛️", "Қарорқабулкунандагон", "Ҳосилғундориро дар тамоми водӣ, ҳатто зери абр, бе интизори ҳисоботи майдон пайгирӣ кунед."],
        ["🔬", "Олимон", "Бо маълумоти майдонӣ муқоиса кунед, то ин санҷишро ба харитаи воқеии зироат табдил диҳед ва рӯиши растаниро аз хоки тар ҷудо кунед."],
        ["🎓", "Омӯзгорон ва ҳама", "Нишон диҳед, ки радар рӯиши растаниро чӣ тавр «мешунавад»: хати сабзи HV ҳангоми калон шудани зироат боло меравад."],
      ],
      check: "Мо аксҳои худро бо аксҳои умумии худи ASF аз ҳамон гузаришҳои NISAR (180 м) муқоиса кардем. Онҳо бо дақиқии тақрибан як пиксел мувофиқ меоянд (r = 0,78 барои HH, 0,82 барои HV дар 13 октябри 2026).",
      c1title: "Водии мо аз кайҳон",
      notSeen: [
        ["Майдонҳои алоҳида", "Як пиксел 60 м аст, бинобар ин қитъаҳои хурд бо ҳам омехта мешаванд. Мо медианаи тамоми киштзорро нишон медиҳем, на ҳар майдонро."],
        ["Хоки тар", "Обёрӣ хокро тар мекунад ва акси садои HH чанд рӯз қавӣ мешавад. Қисми афзоиши HH метавонад обёрӣ бошад, на растанӣ."],
        ["Кадом зироат", "Худи радар пахтаро аз гандум ё боғ фарқ намекунад. «Асосан пахта» он чизест, ки дар бораи минтақа маълум аст, на хулосаи ин харита."],
        ["Пахтачинии дастӣ", "Ҳангоми пахтачинии дастӣ бутаҳо истода мемонанд, бинобар ин то тоза кардани ғӯзапоя радар тағйироти кам мебинад."],
      ],
      caveats: [
        "Ин санҷиши фикр аст, на харитаи зироат: «киштзор» дар ин ҷо танҳо замини ҳамвор (нишебӣ камтар аз 2°) бо акси садои маъмулии майдон мебошад.",
        "То 6 ноябр аз 28 то 54 км² (4–8%) пастшавии калони HV-ро нишон медиҳанд; 13 октябр тақрибан 25 км² буд. Фарқ калон аст, чунки ду гузариши охирин аз версияи навтари маълумот мебошанд, ки 0,2–0,6 дБ пасттар нишон медиҳад, ва сеяки рақами калонтар пикселҳои танҳо мебошанд. Шояд ҳосилғундорӣ намоён шуда истода бошад, аммо гуфта наметавонем, ки масоҳат ду баробар шуд. Инҳо номзадҳоянд, на тасдиқшуда дар ҷой.",
        "Афзоиши тақрибан 1 дБ хурд, вале мувофиқ аст: нисфи мобайнии ҳамаи майдонҳо (рахи сабз) якҷоя баланд шуд.",
        "Аз 21 июл то 14 август гузариш нест (холигии маълумоти NISAR).",
      ],
    },
    spot: [68.75129, 37.92274], // a typical cotton field whose HV rose ~4.6 dB June→September (for the tour)
    facts: "",
    media: [],
  },
  nepal: {
    en: {
      name: "Bhote Koshi–Trishuli",
      region: "Rasuwa, Nepal",
      country: "Nepal",
      river: "Bhote Koshi–Trishuli",
      actions: [
        ["🚑", "Emergency teams", "After the very next pass, list the river stretches that changed most (here near Devighat and Galchhi) and send inspections there first."],
        ["🏗️", "Engineers and hydropower operators", "Check bridges, roads and water intakes along the wider, wetter channel."],
        ["🔬", "Scientists", "Separate flood scars from the season and the rice harvest, as this page does, before counting damage."],
        ["🎓", "Teachers and the public", "Show why a flood in a gorge leaves scars, not a lake, and why radar can see them through monsoon cloud."],
      ],
      check: "We compared our pictures with ASF's own browse images of the same NISAR passes (170 m). In these steep mountains ASF's pictures are dominated by radar shadow and layover, so we matched the dark river channels instead: they line up best with no shift, and the match falls five-fold 600 m away.",
      where: "Betrawati",
      welcomeTitle: "A Himalayan flood, seen through the clouds",
      welcome: () =>
        "On 26 August 2026 a rock-and-ice avalanche high in the Himalaya sent a flood down the Bhote Koshi–Trishuli river in Nepal. It was monsoon season and clouds hid the valleys from cameras. The NASA–ISRO radar satellite NISAR flew over every 12 days and saw what the flood left behind.",
      intro: () =>
        "The Bhote Koshi comes down from Tibet through a deep gorge at Rasuwagadhi, then joins the Trishuli near Betrawati. Villages, a main road to China and several hydropower plants sit on the narrow valley floor. NISAR passed here 6 times before the flood and 7 times after it, up to 11 November. The flood map compares the 6 passes before with the first 5 after.",
      why: "When a mass of rock and ice falls into a mountain valley, it can dam the river or melt into a sudden flood. The water rushes down the gorge carrying mud, sand and boulders. Where the valley widens, near Betrawati, the flood slows and drops its load: smooth mud and sand that send the radar signal away, so the riverbed turns darker and stays dark.",
      matters:
        "Floods like this hit roads, bridges, power plants and homes within minutes, usually when clouds make satellite photos useless. Radar sees through clouds, so a map of what changed can be made after the very next pass, for rescue teams and for engineers who need to know which parts of the valley were hit.",
      hotspot:
        "At Betrawati, where the Bhote Koshi meets the Trishuli, the valley widens. Here the radar echo fell by about 4 dB right after the flood and stayed low: the riverbed is covered with fresh mud and debris (about 0.3 km²).",
      tourWhy:
        "The flood carried mud and debris down the gorge and dropped it where the valley widens. Smooth mud reflects the radar signal away, so the riverbed turned dark.",
      human:
        "This change was sudden and natural, but it hit a place full of people: villages on the river bank, the road to the border, and hydropower plants that use the steep river.",
      personal:
        "We are a team from Tajikistan. Our Pamir valleys face the same danger: glacial lakes that burst and mudflows (sel) that fill a riverbed in minutes. We tested NISAR on this Himalayan flood because the same method could watch our own valleys.",
      notSeen: [
        ["The steep gorge", "From Rasuwagadhi to Syabrubesi the gorge is so steep that slopes facing the radar fold over the river (layover) and slopes facing away are in radar shadow. At 60 m the riverbed there is hidden, so the flood's upper path cannot be mapped."],
        ["The season", "After the monsoon every Himalayan river shrinks and shows its gravel bars, which makes the echo stronger. That looks like change even without a flood, so red areas south of Betrawati are mostly the season."],
        ["Small things", "One radar pixel is 60 m wide (10 m in the close-up). A damaged bridge or house is about that size or smaller and cannot be seen reliably."],
      ],
      cuWhy:
        "A flood in a narrow Himalayan gorge does not leave a big lake for a radar to see: the water passes in hours, NISAR returns only every 12 days, the river is a few pixels wide, and steep walls hide parts of the valley. What stays are scars: a wider channel full of wet sand and mud, debris and eroded banks. The close-up looks for those scars along the Trishuli, from Betrawati down to Galchhi.",
      cuPlaces: { Betrawati: "Betrawati", "Trishuli Bazar (Bidur)": "Trishuli Bazar (Bidur)", Devighat: "Devighat", Galchhi: "Galchhi" },
      caveats: [
        "At 60 m the flood signal we are sure of is small: about 0.3 km² of mud near Betrawati. The 10 m close-up shows more: 1.9 km² of wider, wetter river channel from Betrawati to Galchhi, against 0.8 km² of the same kind of change in the quiet test before the flood.",
        "Most of the red (brighter) area is the river shrinking after the monsoon, not the flood: it started before 26 Aug and also happens on rivers the flood never reached.",
        "The upper gorge is hidden by layover and shadow, so the map does not show the whole flood path.",
      ],
    },
    ru: {
      name: "Бхоте-Коси — Тришули",
      region: "Расува, Непал",
      country: "Непал",
      river: "Бхоте-Коси — Тришули",
      actions: [
        ["🚑", "Спасатели", "Уже после следующего пролёта составьте список участков реки, которые изменились сильнее всего (здесь у Девигхата и Галчхи), и отправьте проверку туда в первую очередь."],
        ["🏗️", "Инженеры и операторы ГЭС", "Проверьте мосты, дороги и водозаборы вдоль расширившегося, более мокрого русла."],
        ["🔬", "Учёные", "Перед подсчётом ущерба отделите следы паводка от сезона и уборки риса, как это сделано на этой странице."],
        ["🎓", "Учителя и все желающие", "Покажите, почему паводок в ущелье оставляет шрамы, а не озеро, и почему радар видит их сквозь муссонные облака."],
      ],
      check: "Мы сравнили наши снимки с собственными обзорными снимками ASF тех же пролётов NISAR (170 м). В этих крутых горах на снимках ASF преобладают радарная тень и наложение, поэтому мы сравнили тёмные русла рек: лучше всего они совпадают без сдвига, а при сдвиге на 600 м совпадение падает в пять раз.",
      where: "Бетравати",
      welcomeTitle: "Гималайский паводок сквозь облака",
      welcome: () =>
        "26 августа 2026 года высоко в Гималаях обвал скал и льда вызвал паводок на реке Бхоте-Коси — Тришули в Непале. Шёл сезон муссонов, и облака скрывали долины от фотокамер. Радарный спутник NASA–ISRO NISAR пролетал здесь каждые 12 дней и увидел, что оставил после себя паводок.",
      intro: () =>
        "Бхоте-Коси спускается из Тибета через глубокое ущелье у Расувагадхи и сливается с Тришули у Бетравати. На узком дне долины стоят сёла, главная дорога в Китай и несколько ГЭС. NISAR пролетел здесь 6 раз до паводка и 7 раз после него, до 11 ноября. Карта паводка сравнивает 6 пролётов до с первыми 5 после.",
      why: "Когда масса камня и льда обрушивается в горную долину, она может перегородить реку или растаять во внезапный паводок. Вода несётся по ущелью, неся грязь, песок и валуны. Там, где долина расширяется, у Бетравати, поток замедляется и сбрасывает груз: гладкая грязь и песок отражают радарный сигнал в сторону, поэтому русло темнеет и остаётся тёмным.",
      matters:
        "Такие паводки за минуты бьют по дорогам, мостам, ГЭС и домам — обычно тогда, когда из-за облаков спутниковые фото бесполезны. Радар видит сквозь облака, поэтому карту изменений можно сделать уже после следующего пролёта — для спасателей и инженеров, которым нужно знать, какие участки долины пострадали.",
      hotspot:
        "У Бетравати, где Бхоте-Коси впадает в Тришули, долина расширяется. Здесь радарное эхо сразу после паводка упало примерно на 4 дБ и не вернулось: русло покрыто свежей грязью и обломками (около 0,3 км²).",
      tourWhy:
        "Паводок пронёс грязь и обломки по ущелью и сбросил их там, где долина расширяется. Гладкая грязь отражает радарный сигнал в сторону, поэтому русло потемнело.",
      human:
        "Это изменение было внезапным и природным, но оно ударило по месту, где живут люди: сёла на берегу реки, дорога к границе и ГЭС, использующие крутую реку.",
      personal:
        "Мы — команда из Таджикистана. Нашим памирским долинам грозит та же опасность: прорывы ледниковых озёр и сели, которые за минуты заполняют русло. Мы проверили NISAR на этом гималайском паводке, потому что тот же метод может следить и за нашими долинами.",
      notSeen: [
        ["Крутое ущелье", "От Расувагадхи до Сябрубеси ущелье настолько крутое, что склоны, обращённые к радару, «наваливаются» на реку, а склоны, обращённые от него, лежат в радарной тени. При пикселе 60 м русло там скрыто, поэтому верхний путь паводка нанести на карту нельзя."],
        ["Сезон", "После муссона каждая гималайская река мелеет и обнажает галечные отмели, и эхо усиливается. Это выглядит как изменение даже без паводка, поэтому красные участки южнее Бетравати — в основном сезон."],
        ["Мелкие объекты", "Один радарный пиксель — 60 м (10 м в крупном плане). Повреждённый мост или дом примерно такого размера или меньше, и надёжно его не увидеть."],
      ],
      cuWhy:
        "Паводок в узком гималайском ущелье не оставляет большого озера, которое увидел бы радар: вода проходит за часы, NISAR возвращается лишь раз в 12 дней, река шириной в несколько пикселей, а крутые склоны скрывают часть долины. Остаются шрамы: расширившееся русло с мокрым песком и грязью, обломки и размытые берега. Крупный план ищет эти шрамы вдоль Тришули, от Бетравати до Галчхи.",
      cuPlaces: { Betrawati: "Бетравати", "Trishuli Bazar (Bidur)": "Тришули-Базар (Бидур)", Devighat: "Девигхат", Galchhi: "Галчхи" },
      caveats: [
        "При пикселе 60 м сигнал паводка, в котором мы уверены, небольшой: около 0,3 км² грязи у Бетравати. Крупный план 10 м показывает больше: 1,9 км² расширившегося, более мокрого русла от Бетравати до Галчхи — против 0,8 км² такого же изменения в контрольной проверке до паводка.",
        "Большая часть красной (более светлой) области — это обмеление реки после муссона, а не паводок: оно началось до 26 августа и происходит и на реках, куда паводок не дошёл.",
        "Верхнее ущелье скрыто наложением и тенью, поэтому карта показывает не весь путь паводка.",
      ],
    },
    tg: {
      name: "Бхоте-Коси — Тришулӣ",
      region: "Расува, Непал",
      country: "Непал",
      river: "Бхоте-Коси — Тришулӣ",
      actions: [
        ["🚑", "Наҷотдиҳандагон", "Пас аз гузариши навбатӣ рӯйхати қисматҳои дарёро, ки бештар тағйир ёфтанд (дар ин ҷо назди Девигҳат ва Галчҳӣ), тартиб диҳед ва санҷишро аввал ба он ҷо фиристед."],
        ["🏗️", "Муҳандисон ва нерӯгоҳҳо", "Пулҳо, роҳҳо ва обгирҳоро дар қади маҷрои васеътар ва тартар санҷед."],
        ["🔬", "Олимон", "Пеш аз ҳисоб кардани зарар нишонаҳои обхезиро аз фасл ва ҳосилғундории шолӣ ҷудо кунед, чунон ки ин саҳифа мекунад."],
        ["🎓", "Омӯзгорон ва ҳама", "Нишон диҳед, ки чаро обхезӣ дар дара на кӯл, балки нишонаҳо мегузорад ва чаро радар онҳоро аз байни абрҳои муссон мебинад."],
      ],
      check: "Мо аксҳои худро бо аксҳои умумии худи ASF аз ҳамон гузаришҳои NISAR (170 м) муқоиса кардем. Дар ин кӯҳҳои тез дар аксҳои ASF сояи радар ва «афтидан» бартарӣ доранд, бинобар ин мо маҷроҳои торики дарёҳоро муқоиса кардем: онҳо беҳтарин бе лағжиш мувофиқ меоянд ва бо лағжиши 600 м мувофиқат панҷ маротиба кам мешавад.",
      where: "Бетравати",
      welcomeTitle: "Обхезии Ҳимолой аз байни абрҳо",
      welcome: () =>
        "26 августи соли 2026 дар баландии Ҳимолой фурӯ рехтани санг ва ях дар дарёи Бхоте-Коси — Тришулӣ дар Непал обхезӣ ба вуҷуд овард. Фасли муссон буд ва абрҳо водиҳоро аз камераҳо пинҳон мекарданд. Моҳвораи радарии NASA–ISRO бо номи NISAR ҳар 12 рӯз аз ин ҷо гузашт ва дид, ки обхезӣ чӣ боқӣ гузошт.",
      intro: () =>
        "Бхоте-Коси аз Тибет тавассути дараи чуқури Расувагадҳӣ поён мефарояд ва назди Бетравати ба Тришулӣ ҳамроҳ мешавад. Дар қаъри танги водӣ деҳаҳо, роҳи асосӣ ба Чин ва якчанд нерӯгоҳи барқи обӣ ҷойгиранд. NISAR дар ин ҷо 6 бор пеш аз обхезӣ ва 7 бор пас аз он, то 11 ноябр, гузашт. Харитаи обхезӣ 6 гузариши пешро бо 5 гузариши аввали пас муқоиса мекунад.",
      why: "Вақте ки тӯдаи санг ва ях ба водии кӯҳӣ меафтад, он метавонад дарёро банд кунад ё ба обхезии ногаҳонӣ табдил ёбад. Об аз дара бо худ лой, рег ва харсанг мебарад. Дар ҷое ки водӣ васеъ мешавад, назди Бетравати, ҷараён суст шуда, борашро мепартояд: лой ва реги ҳамвор сигнали радарро ба тараф мебаранд, барои ҳамин маҷро торик мешавад ва торик мемонад.",
      matters:
        "Чунин обхезиҳо дар чанд дақиқа ба роҳҳо, пулҳо, нерӯгоҳҳо ва хонаҳо зарба мезананд — одатан вақте ки аз сабаби абр аксҳои моҳвораӣ бефоидаанд. Радар аз байни абр мебинад, бинобар ин харитаи тағйиротро пас аз гузариши навбатӣ барои наҷотдиҳандагон ва муҳандисоне, ки бояд донанд кадом қисми водӣ зарар дид, тайёр кардан мумкин аст.",
      hotspot:
        "Назди Бетравати, ки Бхоте-Коси ба Тришулӣ мерезад, водӣ васеъ мешавад. Дар ин ҷо акси садои радар дарҳол пас аз обхезӣ тақрибан 4 дБ паст шуд ва барнагашт: маҷро бо лой ва партовҳои нав пӯшида аст (тақрибан 0,3 км²).",
      tourWhy:
        "Обхезӣ лой ва партовҳоро аз дара овард ва дар ҷое ки водӣ васеъ мешавад, партофт. Лойи ҳамвор сигнали радарро ба тараф мебарад, барои ҳамин маҷро торик шуд.",
      human:
        "Ин тағйирот ногаҳонӣ ва табиӣ буд, аммо ба ҷое зад, ки одамон зиндагӣ мекунанд: деҳаҳои соҳили дарё, роҳи сарҳад ва нерӯгоҳҳое, ки аз дарёи тез истифода мебаранд.",
      personal:
        "Мо дастае аз Тоҷикистон ҳастем. Водиҳои Помири мо ба ҳамин гуна хатар рӯ ба рӯ ҳастанд: рахна шудани кӯлҳои пиряхӣ ва селҳое, ки дар чанд дақиқа маҷроро пур мекунанд. Мо NISAR-ро дар ҳамин обхезии Ҳимолой санҷидем, зеро ҳамин усул метавонад водиҳои моро низ назорат кунад.",
      notSeen: [
        ["Дараи тез", "Аз Расувагадҳӣ то Сябрубесӣ дара он қадар тез аст, ки нишебиҳои рӯ ба радар ба болои дарё «меафтанд» ва нишебиҳои пушт ба радар дар сояи радар мемонанд. Бо пиксели 60 м маҷро дар он ҷо пинҳон аст, бинобар ин роҳи болоии обхезиро ба харита гузоштан мумкин нест."],
        ["Фасл", "Пас аз муссон ҳар дарёи Ҳимолой кам шуда, ҷазираҳои сангрезаашро нишон медиҳад ва акси садо қавӣ мешавад. Ин бе обхезӣ ҳам мисли тағйирот менамояд, бинобар ин ҷойҳои сурхи ҷанубтар аз Бетравати асосан фасл мебошанд."],
        ["Чизҳои хурд", "Як пиксели радар 60 м аст (дар наздик-намо 10 м). Пул ё хонаи вайроншуда тақрибан ҳамин андоза ё хурдтар аст ва онро боэътимод дидан мумкин нест."],
      ],
      cuWhy:
        "Обхезӣ дар дараи танги Ҳимолой кӯли калоне намегузорад, ки радар бубинад: об дар чанд соат мегузарад, NISAR танҳо ҳар 12 рӯз бармегардад, дарё ҳамагӣ чанд пиксел паҳно дорад ва нишебиҳои тез қисми водиро пинҳон мекунанд. Он чи мемонад, нишонаҳост: маҷрои васеъшуда бо реги тар ва лой, партовҳо ва соҳилҳои шусташуда. Наздик-намо ин нишонаҳоро дар қади Тришулӣ, аз Бетравати то Галчҳӣ, меҷӯяд.",
      cuPlaces: { Betrawati: "Бетравати", "Trishuli Bazar (Bidur)": "Тришулӣ-Бозор (Бидур)", Devighat: "Девигҳат", Galchhi: "Галчҳӣ" },
      caveats: [
        "Бо пиксели 60 м сигнали обхезӣ, ки мо ба он боварӣ дорем, хурд аст: тақрибан 0,3 км² лой назди Бетравати. Наздик-намои 10 м бештар нишон медиҳад: 1,9 км² маҷрои васеътар ва тартар аз Бетравати то Галчҳӣ, дар муқобили 0,8 км² ҳамин гуна тағйирот дар санҷиши назоратии пеш аз обхезӣ.",
        "Қисми зиёди минтақаи сурх (равшантар) кам шудани дарё пас аз муссон аст, на обхезӣ: он пеш аз 26 август сар шуд ва дар дарёҳое, ки обхезӣ ба онҳо нарасид, низ рӯй медиҳад.",
        "Дараи болоӣ бо «афтидан» ва соя пинҳон аст, бинобар ин харита тамоми роҳи обхезиро нишон намедиҳад.",
      ],
    },
    media: [],
  },
};

export function storyFor(id, lang = "en") {
  const site = STORIES[id] || {};
  const base = { ...GENERIC.en, ...(GENERIC[lang] || {}) };
  return {
    ...base,
    ...(site.en || {}),
    ...(site[lang] || {}),
    facts: site.facts || "",
    spot: site.spot || null,
    media: (site.media || []).map((x) => ({ ...x, caption: typeof x.caption === "string" ? x.caption : x.caption?.[lang] ?? x.caption?.en ?? "" })),
    notSeen: site[lang]?.notSeen || site.en?.notSeen || NOT_SEEN[lang] || NOT_SEEN.en,
    future: FUTURE[lang] || FUTURE.en,
  };
}
