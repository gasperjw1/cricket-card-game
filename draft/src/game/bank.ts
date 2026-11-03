/**
 * The fragment bank behind `prose.ts` (authored 2026-11-01). Frames are templates: `{slot}` from
 * the fact, `{n:word}` a counted noun, `[list]` a fragment drawn from `lists`. No digits anywhere
 * in this file: every number a sentence prints must come from the match. British register, teams
 * plural ("India are"), no exclamation marks.
 *
 * Slots by fact (see facts.ts): hundred {player surname runs balls fours sixes notOut team}; fiveFor
 * {player surname wickets runs balls team}; hatTrick {player surname wickets runs team}; captainDuck
 * {player surname balls team}; subHundred {team runs wickets balls opp}; bigTotal {team runs wickets
 * opp}; bigChase {team runs wickets target opp}; loneHand {player surname runs balls share total
 * notOut team}; standoutBowler {player surname wickets runs balls econ othersEcon team}; collapse
 * {team wickets runs from opp}; bigStand {team runs balls wicket a b opp}; lateSurge {team peakRate
 * startRate target}; finalOverTwenty {team runs target}; upset {team loser}; firstWin {team after};
 * unbeatenRun {team wins}; knockout {team loser}; nailBiter {team runs | wickets ballsLeft}; rout
 * {team loser runs | wickets ballsLeft}; superOver/bowlOut/coinToss {team}; dls {team runs}; records
 * {holder team opp value value2 prevHolder prevTeam prevValue prevValue2 daysSince timesBroken}.
 */

export type BankLists = Record<string, readonly string[]>;

export interface Bank {
  lists: BankLists;
  facts: Record<string, readonly string[]>;
  stopPress: Record<string, readonly string[]>;
  results: Record<"runs" | "wickets" | "lastBall" | "dls" | "superOver" | "bowlOut" | "coinToss" | "noResult" | "plain", readonly string[]>;
}

export const BANK: Bank = {
  lists: {
    // How a side got home.
    calmly: ["without fuss", "with something to spare", "in the end comfortably", "with the result never really in doubt", "at a canter", "in good order"],
    narrowly: ["by the narrowest of margins", "with nothing to spare", "off the back of a frantic finish", "after a finish that could have gone either way", "with the ground holding its breath", "in a finish nobody at the ground will forget quickly"],
    // Colour for a big innings.
    innings_colour: ["an innings of real authority", "an innings that set the tone", "the innings of the day", "a knock that never looked hurried", "an innings built on timing rather than force", "a measured innings that gathered pace late", "a display of clean striking"],
    early: ["from the first over", "early on", "before the field had spread", "in the powerplay", "while the ball was still new"],
    late: ["at the death", "in the closing overs", "when it mattered most", "as the chase tightened", "with the end in sight"],
    // Verbs for bowling spells.
    spell_verb: ["ran through", "picked apart", "dismantled", "worked over", "cut through", "took the heart out of"],
    spell_colour: ["a spell of sustained accuracy", "a spell that gave the batters nothing", "the decisive spell of the match", "a spell that changed the afternoon", "four overs the batters never got hold of"],
    // Openers for a report sentence.
    report_open: ["For all that,", "In truth,", "By the end,", "As it turned out,", "On the day,", "In the circumstances,"],
    // Closers.
    closer: ["and that was that", "and the rest was arithmetic", "and the game was gone", "and the contest was over", "and there was no way back"],
    collapse_verb: ["lost", "shed", "surrendered", "gave away", "threw away"],
    collapse_colour: ["in a heap", "in a rush", "in the space of a few overs", "almost before anyone had noticed", "without a run of substance between them"],
    stand_colour: ["a stand that decided the match", "a partnership that took the game away", "a stand the bowlers could not break", "a partnership of patience and then power", "the stand that settled it"],
    nerve: ["held their nerve", "kept their heads", "did not flinch", "found a way", "got over the line"],
    keeping: ["keeping", "holding", "carrying", "steering"],
    tail_off: ["the tail could not repair the damage", "nobody below them could stay", "the lower order came and went", "the rest followed in short order"],
    upset_colour: ["a result that will be talked about long after this tournament", "a result that turned heads", "a result few had expected", "a day the associate game will remember", "the kind of afternoon this format was made for"],
    // From the corpus of real World Cup reports (docs/wc-draft-report-style-corpus-2026-11-02.md), in our own words.
    cruise_verb: ["cruised past", "eased past", "saw off", "made light work of", "swept aside", "brushed aside", "strolled past", "romped past"],
    rout_verb: ["crushed", "thrashed", "hammered", "thumped", "dismantled", "blew away", "put to the sword", "overpowered"],
    edge_verb: ["edged past", "held off", "scraped past", "squeezed past", "got the better of", "saw off"],
    upset_verb: ["stunned", "shocked", "upset", "toppled", "ambushed", "humbled"],
    chase_verb: ["chased down", "knocked off", "overhauled", "ran down", "hunted down", "reeled in"],
    skittle_verb: ["skittled", "rolled", "bowled out", "bundled out", "shot out", "dismissed"],
    seal_verb: ["sealed", "secured", "clinched", "wrapped up", "rubber-stamped", "booked"],
    narrow_finish: ["in a last-over finish", "with the ground on its feet", "after a finish that went to the wire", "in a nerve-jangling finish", "with nothing between the sides until the end", "after a grandstand finish"],
    tight_colour: ["nip and tuck all the way", "a game that swung with every over", "a contest that was never settled until it was", "an evening of shifting pendulums", "a match that found its way to the final over"],
    chase_tempo: ["up with the rate throughout", "ahead of the rate from the powerplay", "never behind the rate", "in control of the chase from early on", "comfortable with the asking rate"],
    chase_wobble: ["after a mid-innings wobble", "after a scare in the middle overs", "having lost their way for a spell", "after the required rate had crept up", "after a flurry of wickets threatened to turn it"],
    defence_colour: ["squeezed the chase out", "strangled the middle overs", "nailed their yorkers at the death", "put the brakes on when it mattered", "kept the asking rate climbing", "gave the chasing side nothing to hit"],
    assault: ["a late flurry", "an assault at the death", "outrageous hitting in the last four overs", "a late surge", "a finish of clean striking", "back-to-back sixes when they were needed"],
    stand_verb: ["put on", "added", "shared", "compiled", "built"],
    stand_colour_b: ["took the game away", "turned the match", "set the platform", "settled the contest", "did the hard work", "carried the innings"],
    collapse_colour_b: ["in a flurry of wickets", "as the wickets kept tumbling", "in tatters", "left reeling", "as the innings disintegrated", "with the lower order coming and going"],
    stakes_colour: ["to keep their hopes alive", "to stay on course for the knockouts", "to blow the group wide open", "to leave the group hanging by a thread", "with their campaign on the line", "with the knockouts in sight"],
    first_win_colour: ["after a wait that had begun to weigh", "and the relief was plain", "at last", "and nobody minded how", "and the dressing room will have slept well"],
    bowling_colour: ["the pick of the attack", "accurate to the last", "the shining light among the gloom", "a spell of control under pressure", "hitting the right length from his first ball"],
    innings_colour_b: ["an innings of real class", "a knock that defied the situation", "an exhibition of clean striking", "a measured innings that gathered pace", "an innings that bossed the attack", "batting of rare authority"],
    report_open_b: ["In the end,", "When it mattered,", "For all the drama,", "On a day of two halves,", "By the close,", "As the dust settled,"],
  },

  facts: {
    hundred: [
      "{player} made {runs} off {balls:ball}, [innings_colour], for {team}.",
      "{player:pos} {runs} off {balls:ball} was [innings_colour]; {team} built everything around it.",
      "There was a hundred for {player}: {runs} off {balls:ball}, with {fours:four} and {sixes:six}.",
      "{surname} reached three figures, finishing on {runs} from {balls:ball}, [innings_colour].",
      "The day belonged to {player}, whose {runs} off {balls:ball} carried {team}.",
      "{player} went to a hundred off {balls:ball} and finished on {runs}, [innings_colour_b].",
      "[report_open_b] it was {player:pos} {runs} that shaped the match, {fours:four} and {sixes:six} among them.",
      "{surname} made {runs}, [innings_colour_b], and {team} had the score they needed.",
      "{runs} from {player}, off {balls:ball}, with the attack reduced to guesswork by the end.",
    ],
    centuryInVain: [
      "{player:pos} {runs} off {balls:ball} came in vain; {winner} had the last word.",
      "A hundred for {player}, {runs} off {balls:ball}, and still {team} lost to {winner}.",
      "{surname} made {runs} and finished on the losing side, which is the cruellest line in the book.",
      "{player} carried {team} to {runs} of his own and watched {winner} take the match anyway.",
    ],
    twinCenturies: [
      "Two hundreds in one match: {other:pos} {otherRuns} for {loser}, then {player:pos} {runs} off {balls:ball} to take it for {team}.",
      "{other} made {otherRuns} and lost; {player} made {runs} and won. A day of two centurions, and only one of them smiling.",
      "{player:pos} {runs} answered {other:pos} {otherRuns}, hundred for hundred, and {team} had the better of it.",
      "A hundred on each side, {other} {otherRuns} for {loser} and {player} {runs} for {team}, and the second was the one that counted.",
    ],
    twoCenturions: [
      "Two {team} hundreds in one innings: {player} {runs} and {other} {otherRuns}.",
      "{player} and {other} both reached three figures for {team}, {runs} and {otherRuns}, and the side {won}.",
      "Not one {team} centurion but two: {surname} {runs}, {other} {otherRuns}.",
    ],
    fiveForInVain: [
      "{player:pos} {wickets} for {runs} was not enough; {winner} won anyway.",
      "A five-for in a losing cause: {player}, {wickets} for {runs}, and {team} beaten by {winner}.",
      "{surname} took {wickets} for {runs} and still ended up on the wrong side of the result.",
    ],
    allRoundShow: [
      "{player} did it with bat and ball: {runs} off {balls:ball}, then {wickets} for {bowlRuns}.",
      "An all-round day for {player}, {runs} and {wickets} for {bowlRuns}, against {opp}.",
      "{surname} made {runs} and took {wickets} for {bowlRuns}; {team} needed little else.",
    ],
    tenWicketWin: [
      "{team} chased {target} without losing a wicket, with {ballsLeft:ball} to spare.",
      "A ten-wicket win for {team}: {loser} bowled, {team} batted, nobody was out.",
      "{team} ran down {target} with all ten wickets standing and {ballsLeft:ball} unused.",
    ],
    hundredInChase: [
      "{player:pos} {runs} off {balls:ball} carried {team} to {target} against {loser}.",
      "A hundred in a chase: {player} {runs}, and {team} were home against {loser}.",
      "{surname} made {runs} with a target of {target} in front of him, and {team} got there.",
    ],
    fiveFor: [
      "{player} took {wickets} for {runs}, [spell_colour].",
      "{player:pos} {wickets} for {runs} [spell_verb] the {team} innings.",
      "There was a five-wicket haul for {player}: {wickets} for {runs} off {balls:ball}.",
      "{surname} finished with {wickets} for {runs}, [spell_colour], and {team} never recovered.",
      "{player}, [bowling_colour], took {wickets} for {runs} as {team} were [skittle_verb].",
      "Five wickets for {player}: {wickets} for {runs}, the {team} middle order [spell_verb] in a few overs.",
    ],
    hatTrick: [
      "{player} took a hat-trick on the way to {wickets} for {runs}.",
      "A hat-trick for {player}, three in three balls, in figures of {wickets} for {runs}.",
      "{surname} had three in three deliveries, and {wickets} for {runs} in all.",
    ],
    captainDuck: [
      "{player}, captaining {team}, went for a duck off {balls:ball}.",
      "The {team} captain, {player}, was out without scoring.",
      "{surname} led {team} out and was back without a run to his name.",
    ],
    subHundred: [
      "{team} were bowled out for {runs} in {balls:ball}.",
      "{team} managed only {runs}, all out, against {opp}.",
      "{opp} bowled {team} out for {runs}.",
      "{team} folded for {runs} against {opp}.",
    ],
    bigTotal: [
      "{team} piled up {runs} for {wickets}, a total out of reach for most sides in this tournament.",
      "{runs} for {wickets} from {team} is a total few sides reach in this tournament.",
      "{team} made {runs} for {wickets}, and {opp} knew the size of the task from the start.",
    ],
    bigChase: [
      "{team} chased {target} down, finishing on {runs} for {wickets}, [calmly].",
      "A chase of {target} is rarely done in this tournament; {team} did it with {wickets} wickets down.",
      "{team} ran down {target} against {opp}, [calmly].",
      "Set {target}, {team} got there, [narrowly] or not, with {runs} for {wickets} on the board.",
      "{team} [chase_verb] {target}, [chase_tempo], and finished on {runs} for {wickets}.",
      "{target} looked a lot until {team} started; they [chase_verb] it with {wickets} wickets down.",
      "{team} were [chase_tempo] and [chase_verb] {target} against {opp}.",
    ],
    loneHand: [
      "{player:pos} {runs} eclipsed the rest of {team:pos} batting, [keeping] them in a {matchShape} that nobody else did much to win.",
      "{player} made {runs} of {team:pos} {total}; the next best was {nextBest}, and that tells the story of this {matchShape}.",
      "The {team} innings was {player:pos} {runs} and not a great deal else, with nobody beyond {nextBest}.",
      "{surname} alone carried {team}, {runs} off {balls:ball} while no team-mate got past {nextBest}.",
      "On a day the {team} batting went missing, {player:pos} {runs} did not, and it was enough in a {matchShape}.",
      "{team} owed this one to {player}: {runs} off {balls:ball}, with {nextBest} the best anyone else managed.",
    ],
    standoutBowler: [
      "{player} took {wickets} for {runs}, [spell_colour].",
      "{player:pos} {wickets} for {runs} set up the win for {team}.",
      "The wickets were {player:pos}: {wickets} for {runs} off {balls:ball}, at {econ} an over.",
      "{surname} finished with {wickets} for {runs}, [spell_colour], and {team} had their win.",
      "{player} was [bowling_colour]: {wickets} for {runs} off {balls:ball}.",
      "The wickets came from {player}, [bowling_colour], {wickets} for {runs}, and {team} took the match.",
    ],
    cheapWickets: [
      "{player} took {wickets} for {runs} at {econ} an over while the rest of the {team} attack went at {othersEcon}.",
      "{player:pos} {wickets} for {runs} stood apart; the other {team} bowlers conceded {othersEcon} an over.",
      "The {team} attack leaked {othersEcon} an over, except for {player}, who took {wickets} for {runs}.",
      "{surname} bowled {balls:ball} for {runs} and {wickets} wickets while the others went at {othersEcon}.",
    ],
    collapse: [
      "{team} [collapse_verb] {wickets} wickets for {runs} runs from {from}, [collapse_colour].",
      "From {from}, {team} [collapse_verb] {wickets} for {runs}, and [tail_off].",
      "The {team} innings turned at {from}: {wickets} wickets for {runs} runs, [collapse_colour].",
      "{team} were {from} and going well; {wickets} wickets for {runs} runs later they were [collapse_colour_b].",
      "From {from}, {team} [collapse_verb] {wickets} for {runs}, [collapse_colour_b].",
    ],
    bigStand: [
      "{a} and {b} put on {runs} in {balls:ball}, [stand_colour].",
      "The {team} stand between {a} and {b} was worth {runs}, [stand_colour].",
      "{a} and {b} added {runs} together, and {opp} had no answer to it.",
      "{a} and {b} [stand_verb] {runs} in {balls:ball}, a stand that [stand_colour_b].",
      "The stand of {runs} between {a} and {b} [stand_colour_b]; {opp} could not break it in time.",
    ],
    lateSurge: [
      "{team} needed {peakRate} an over inside the last five and still got there.",
      "With five overs left the ask had climbed to {peakRate} an over; {team} [nerve].",
      "A chase that began at {startRate} an over swelled to {peakRate} in the last five, and {team} won it anyway.",
    ],
    finalOverTwenty: [
      "{team} took {runs} off the final over to win.",
      "The last over went for {runs}, and {team} were home.",
      "{runs} came off the twentieth over, and with them the match for {team}.",
    ],
    upset: [
      "{team} beat {loser}, [upset_colour].",
      "{loser} were beaten by {team}, [upset_colour].",
      "{team} over {loser} was [upset_colour].",
      "{team} [upset_verb] {loser}, [upset_colour].",
      "A famous win: {team} [upset_verb] {loser}, and the result will travel.",
      "{loser} had the names; {team} had the day, [upset_colour].",
    ],
    firstWin: [
      "It was {team:pos} first win of the tournament, at the {attempt:nth} attempt.",
      "{team} had waited {after:match} for a win; this was it.",
      "After {after} matches without a win, {team} finally had one.",
    ],
    unbeatenRun: [
      "{team} are unbeaten after {wins:match}.",
      "That is {wins:match} without defeat for {team}.",
      "{team} stretched their unbeaten run to {wins:match}.",
    ],
    knockout: [
      "{loser} go home; {team} go on.",
      "For {loser} the tournament ended here. {team} march on.",
      "{team} knocked {loser} out of the World Cup.",
      "{team} [seal_verb] their place in the next round; {loser} are on the plane home.",
      "An early exit for {loser}; {team} go through, [stakes_colour].",
    ],
    final: [
      "{team} are world champions. {loser} fell at the last.",
      "The World Cup belongs to {team}; {loser} will think about this one for a long time.",
      "It all came down to this, and it was {team} who held their nerve; {loser} had come so far for nothing.",
      "{team} lifted the trophy, and {loser} were left with the memory of a final that got away.",
    ],
    rainReduced: [
      "Rain cut the match to {overs:over} a side before a ball was bowled.",
      "The weather had its say first: {overs:over} a side.",
      "A shortened match, {overs:over} each, after rain delayed the start.",
    ],
    nailBiter: [
      "{team} won it [narrowly].",
      "It finished [narrowly] in favour of {team}.",
      "{team} [nerve], [narrowly].",
      "{team} [edge_verb] their opponents [narrow_finish].",
      "It was [tight_colour], and {team} [nerve] [narrow_finish].",
      "{team} got over the line [narrow_finish], [tight_colour].",
    ],
    rout: [
      "{team} swept {loser} aside, [calmly].",
      "It was a rout: {loser} were never in it, and {team} won [calmly].",
      "{loser} were well beaten; {team} won [calmly].",
      "{team} [rout_verb] {loser}, [calmly].",
      "{team} [cruise_verb] {loser}; it was over long before the end.",
      "A one-sided afternoon: {team} [rout_verb] {loser} and the crowd drifted away early.",
    ],
    superOver: [
      "The scores finished level and {team} won the super over.",
      "A tie, and {team} took the super over.",
      "It went to a super over, which {team} won.",
    ],
    bowlOut: [
      "The scores finished level and {team} won the bowl-out.",
      "A tie, decided by a bowl-out in {team:pos} favour.",
    ],
    coinToss: [
      "The scores finished level and the match went to {team} on the toss of a coin.",
    ],
    dls: [
      "Rain had the last word; {team} won by {runs:run} on Duckworth-Lewis.",
      "{team} were ahead of the par score when the rain came, and won by {runs:run} on Duckworth-Lewis.",
      "The result came by the Duckworth-Lewis method, {team} by {runs:run}.",
    ],
    noResult: [
      "Rain washed the match out and the points were shared.",
      "There was no result; the weather saw to that.",
      "The rain won; the two sides took a point each.",
    ],
    "record:highestTotal": [
      "{team:pos} {value} for {value2} is the highest total {scopeText}, past the {prevValue} {prevTeam} made {prevWhen}.",
      "The highest total {scopeText} now belongs to {team}: {value} for {value2}, beating {prevTeam:pos} {prevValue}, set {prevWhen}.",
      "{value} for {value2} by {team} took the highest total {scopeText} off {prevTeam}, whose {prevValue} had stood since {prevWhen}.",
    ],
    "record:lowestTotal": [
      "{team:pos} {value} all out is the lowest completed total {scopeText}, below the {prevValue} {prevTeam} made {prevWhen}.",
      "{value} is now the lowest total {scopeText}, {team} taking that mark from {prevTeam}, whose {prevValue} was set {prevWhen}.",
    ],
    "record:highestChase": [
      "{team:pos} {value} is the highest successful chase {scopeText}, past the {prevValue} {prevTeam} ran down {prevWhen}.",
      "No side had chased more than {prevValue} {scopeText} until {team} ran down {value}.",
      "The highest chase {scopeText} now stands at {value}, by {team}, beating {prevTeam:pos} {prevValue} set {prevWhen}.",
    ],
    "record:bestFigures": [
      "{holder:pos} {value} for {value2} are the best figures {scopeText}, better than {prevHolder:pos} {prevValue} for {prevValue2}, set {prevWhen}.",
      "The best bowling figures {scopeText} now belong to {holder}: {value} for {value2}, past {prevHolder:pos} {prevValue} for {prevValue2}.",
      "{value} for {value2} by {holder} beat {prevHolder:pos} {prevValue} for {prevValue2}, set {prevWhen}, as the best figures {scopeText}.",
    ],
    "record:highestScore": [
      "{holder:pos} {value} is the highest individual score {scopeText}, past the {prevValue} {prevHolder} made {prevWhen}.",
      "The highest score {scopeText} is now {holder:pos} {value}; {prevHolder:pos} {prevValue}, made {prevWhen}, had held it.",
      "{value} by {holder} took the highest score {scopeText} from {prevHolder}, whose {prevValue} was made {prevWhen}.",
    ],
    "record:biggestRunsWin": [
      "{team:pos} win by {value:run} is the biggest by runs {scopeText}, past the {prevValue} {prevTeam} won by {prevWhen}.",
      "No side had won by more than {prevValue:run} {scopeText}; {team} won by {value}.",
    ],
    "record:biggestBallsWin": [
      "{team} won with {value:ball} to spare, the most {scopeText}, past the {prevValue} {prevTeam} had in hand {prevWhen}.",
      "The quickest finish {scopeText}: {team} with {value:ball} left, beating {prevTeam:pos} {prevValue}.",
    ],
    "record:fastestFifty": [
      "{holder:pos} fifty off {value:ball} is the fastest {scopeText}, quicker than the {prevValue} {prevHolder} needed {prevWhen}.",
      "The fastest fifty {scopeText} now belongs to {holder}, off {value:ball}; {prevHolder} had it off {prevValue}, {prevWhen}.",
    ],
  },

  stopPress: {
    hundred: ["{player} {runs} off {balls:ball}.", "A hundred for {player}: {runs} off {balls:ball}.", "{surname} {runs}; {team} built on it."],
    fiveFor: ["{player} {wickets} for {runs}.", "Five for {player}: {wickets} for {runs}.", "{surname} {wickets} for {runs} against {team}."],
    hatTrick: ["Hat-trick for {player}.", "{player}: three in three balls.", "{surname} takes a hat-trick."],
    upset: ["{team} beat {loser}.", "{loser} beaten by {team}.", "{team} over {loser}; the result of the day."],
    bigChase: ["{team} chase {target}.", "{target} chased by {team}, {wickets} down.", "{team} run down {target} against {opp}."],
    lastBall: ["{team} win off the last ball.", "Last-ball win for {team}.", "{team} home off the final delivery."],
    lateSurge: ["{team} win from {peakRate} an over needed.", "{team} needed {peakRate} an over late and got there.", "Late surge: {team} win from {peakRate} an over."],
    finalOverTwenty: ["{team} take {runs} off the last over to win.", "{runs} off the final over; {team} win.", "Final over goes for {runs}; {team} home."],
    superOver: ["{team} win the super over.", "Tie; {team} take the super over.", "Super over to {team}."],
    final: ["{team} are world champions.", "{team} win the World Cup; {loser} beaten in the final.", "The World Cup goes to {team}."],
    centuryInVain: ["{player} {runs} in a losing cause.", "{surname} {runs}; {team} still lose to {winner}.", "A hundred in vain: {player} {runs}."],
    twinCenturies: ["{player} {runs} trumps {other:pos} {otherRuns}.", "Hundred for hundred: {player} {runs}, {other} {otherRuns}; {team} win.", "Two centurions; {player:pos} {runs} the one that won."],
    twoCenturions: ["Two {team} hundreds: {player} {runs}, {other} {otherRuns}.", "{player} and {other} both make hundreds for {team}."],
    fiveForInVain: ["{player} {wickets} for {runs} in a losing cause.", "Five-for in vain: {player} {wickets} for {runs}."],
    allRoundShow: ["{player}: {runs} and {wickets} for {bowlRuns}.", "{surname} with bat and ball: {runs}, then {wickets} for {bowlRuns}."],
    tenWicketWin: ["{team} win by ten wickets.", "Ten-wicket win for {team} over {loser}."],
    hundredInChase: ["{player} {runs} chases down {target}.", "{surname} hundred takes {team} to {target}."],
    bowlOut: ["{team} win the bowl-out.", "Tie; bowl-out to {team}."],
    coinToss: ["Tie; {team} win on the toss of a coin."],
    "record:highestTotal": ["{team} {value} for {value2}: the highest total {scopeText}.", "A record total {scopeText}: {team} {value} for {value2}."],
    "record:lowestTotal": ["{team} all out for {value}: the lowest total {scopeText}.", "A record low {scopeText}: {team} {value} all out."],
    "record:highestChase": ["{team} chase {value}: the highest {scopeText}.", "A record chase {scopeText}: {team} {value}."],
    "record:bestFigures": ["{holder} {value} for {value2}: the best figures {scopeText}.", "Record figures {scopeText}: {holder} {value} for {value2}."],
    "record:highestScore": ["{holder} {value}: the highest score {scopeText}.", "A record score {scopeText}: {holder} {value}."],
    "record:biggestRunsWin": ["{team} win by {value:run}: the biggest margin {scopeText}."],
    "record:biggestBallsWin": ["{team} win with {value:ball} to spare: the most {scopeText}."],
    "record:fastestFifty": ["{holder} fifty off {value:ball}: the fastest {scopeText}."],
  },

  results: {
    runs: [
      "{winner} beat {loser} by {runs:run}.",
      "{winner} defended their total against {loser}, winning by {runs:run}.",
      "{loser} fell {runs:run} short against {winner}.",
      "{winner} held {loser} off by {runs:run}.",
      "A win by {runs:run} for {winner} over {loser}.",
      "{winner} [edge_verb] {loser} by {runs:run}.",
      "{winner} [cruise_verb] {loser}, by {runs:run} in the end.",
      "{loser} came up {runs:run} short against {winner}.",
      "{winner} defended their total and beat {loser} by {runs:run}.",
    ],
    wickets: [
      "{winner} beat {loser} by {wickets:wicket} with {ballsLeft:ball} to spare.",
      "{winner} chased down {loser:pos} total with {wickets:wicket} and {ballsLeft:ball} in hand.",
      "{loser} could not defend their total; {winner} won by {wickets:wicket}, {ballsLeft:ball} left.",
      "{winner} got home against {loser} by {wickets:wicket}, with {ballsLeft:ball} unused.",
      "A {wickets}-wicket win for {winner} over {loser}, {ballsLeft:ball} to spare.",
      "{winner} [chase_verb] {loser:pos} total by {wickets:wicket}, {ballsLeft:ball} to spare.",
      "{winner} [cruise_verb] {loser} by {wickets:wicket} with {ballsLeft:ball} left.",
      "{winner} beat {loser} by {wickets:wicket}, [chase_tempo], {ballsLeft:ball} in hand.",
    ],
    lastBall: [
      "{winner} beat {loser} by {wickets:wicket} off the last ball.",
      "{winner} won off the final delivery against {loser}, by {wickets:wicket}.",
      "It went to the last ball, and {winner} took it from {loser} by {wickets:wicket}.",
      "{winner} [edge_verb] {loser} off the final ball, by {wickets:wicket}.",
      "A last-ball finish: {winner} by {wickets:wicket} over {loser}.",
    ],
    dls: [
      "{winner} beat {loser} by {runs:run} on Duckworth-Lewis.",
      "Rain shortened it; {winner} were {runs:run} ahead of par against {loser}.",
    ],
    superOver: [
      "{winner} and {loser} tied; {winner} won the super over.",
      "A tie between {winner} and {loser}, settled in {winner}'s favour by a super over.",
    ],
    bowlOut: [
      "{winner} and {loser} tied; {winner} won the bowl-out.",
    ],
    coinToss: [
      "{winner} and {loser} tied; the coin fell for {winner}.",
    ],
    noResult: [
      "{a} and {b} were rained off.",
      "No result between {a} and {b}; the rain won.",
      "{a} against {b} was abandoned.",
    ],
    plain: [
      "{winner} beat {loser}.",
    ],
  },
};
