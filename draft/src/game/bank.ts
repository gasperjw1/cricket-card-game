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
  },

  facts: {
    hundred: [
      "{player} made {runs} off {balls:ball}, [innings_colour], for {team}.",
      "{player:pos} {runs} off {balls:ball} was [innings_colour]; {team} built everything around it.",
      "There was a hundred for {player}: {runs} off {balls:ball}, with {fours:four} and {sixes:six}.",
      "{surname} reached three figures, finishing on {runs} from {balls:ball}, [innings_colour].",
      "The day belonged to {player}, whose {runs} off {balls:ball} carried {team}.",
    ],
    fiveFor: [
      "{player} took {wickets} for {runs}, [spell_colour].",
      "{player:pos} {wickets} for {runs} [spell_verb] the {team} innings.",
      "There was a five-wicket haul for {player}: {wickets} for {runs} off {balls:ball}.",
      "{surname} finished with {wickets} for {runs}, [spell_colour], and {team} never recovered.",
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
      "{opp} were left with little to chase after {team} were dismissed for {runs}.",
      "{team:pos} {runs} all out was never going to be enough.",
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
      "{player:pos} {wickets} for {runs} [spell_verb] the chase for {team}.",
      "The wickets were {player:pos}: {wickets} for {runs} off {balls:ball}, at {econ} an over.",
      "{surname} finished with {wickets} for {runs}, [spell_colour], and {team} had their win.",
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
    ],
    bigStand: [
      "{a} and {b} put on {runs} in {balls:ball}, [stand_colour].",
      "The {team} stand between {a} and {b} was worth {runs}, [stand_colour].",
      "{a} and {b} added {runs} together, and {opp} had no answer to it.",
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
    ],
    rout: [
      "{team} swept {loser} aside, [calmly].",
      "It was a rout: {loser} were never in it, and {team} won [calmly].",
      "{loser} were well beaten; {team} won [calmly].",
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
    ],
    wickets: [
      "{winner} beat {loser} by {wickets:wicket} with {ballsLeft:ball} to spare.",
      "{winner} chased down {loser:pos} total with {wickets:wicket} and {ballsLeft:ball} in hand.",
      "{loser} could not defend their total; {winner} won by {wickets:wicket}, {ballsLeft:ball} left.",
      "{winner} got home against {loser} by {wickets:wicket}, with {ballsLeft:ball} unused.",
      "A {wickets}-wicket win for {winner} over {loser}, {ballsLeft:ball} to spare.",
    ],
    lastBall: [
      "{winner} beat {loser} by {wickets:wicket} off the last ball.",
      "{winner} won off the final delivery against {loser}, by {wickets:wicket}.",
      "It went to the last ball, and {winner} took it from {loser} by {wickets:wicket}.",
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
