# Jeopardy

Thie goal for this project is to build a website to play Jeopardy.

## Interface

- Should allow for 2 to 5 contestants
- The host will have their screen shared on a tv or projector for everyone else to see.
- At startup, the host can enter the number of contestants and their names
- The main screen shows the jeopardy board, and each dollar value can be clicked on to reveal the "answer" for all to see
    - Below the answer, there should be buttons for each contestant, such that the host can click if the contestant answered correctly (adding the dollar value to their score) or incorrectly (subtracting the dollar value from their score)
    - If the answer is a daily double, the host must select the name of the person who controls the board. the interface then updates to show that player's current dollar total, and allows them to place a bet. all this must happen BEFORE the answer is revealed. Then the host can hit a button for if they got it correct or not.
- Must support a Jeopardy round, a Double Jeopardy round, and a Final Jeopardy round
    - For final Jeopardy, first show the category and everyone's dollar totals. Then we will let players write down on paper their wager and their question. After the timer has expired, let the host input each player's wager and whether they got it right or wrong.


## Feasibility study

I want to know if it will be possible using a html + typescript website to be able to have players open the site and enter a password to join the session. The purpose of this is for them to have a buzzer button to hit so that the host's screen will show who buzzed in first. If this is not possible, we will use in-person buzzer options.

## Look and Feel

See board.png for the full board. We are going to want to use the colors and fonts from that image for the website.
See clue-card.png for the card that should be displayed when an answer is revealed.
For now, attempt to best match all of the fonts needed using open source fonts that you can grab from the web. Make it easy for me to drop in font replacements later.
A clue has been revealed and completed, the dollar value of that clue should no longer be visible (it should appear as an empty blue square), but it should still be clickable just in case the host needs to go back and adjust the score for a contestant. When reviewing an old clue, the clue should be displayed in the same way it was before it was revealed, and the scoring area should reflect which contestant was credited and/or docked points for that clue.

## Data Structure

We need to have a yaml file which contains the data for the board. The file should be laid out as follows (extending of course to have 6 categories for the jeopardy and final jeopardy rounds, and 5 answers per category):

```yaml
jeopardy:
  - category: "Category 1"
    questions:
      - value: 100
        answer: "Answer 1"
      - value: 200
        answer: "Answer 2"
  - category: "Category 2"
    questions:
      - value: 100
        answer: "Answer 1"
      - value: 200
        answer: "Answer 2"
double_jeopardy:
  - category: "Category 1"
    questions:
      - value: 100
        answer: "Answer 1"
      - value: 200
        answer: "Answer 2"
  - category: "Category 2"
    questions:
      - value: 100
        answer: "Answer 1"
      - value: 200
        answer: "Answer 2"
final_jeopardy:
  category: "Category 1"
  answer: "Answer"
```

Create a skeleton of this file with empty quote strings for each of the categories and answers for me to fill in.

## Action Items for first steps

1. Determine the tech stack
    - The tech stack you suggested is acceptable.
2. Determine if the "buzzer" functionality is possible
    - Let's use option A
3. Create the skeleton yaml file
    - You raised an excellent point about designating daily doubles. I will add a field called "daily_double" to the yaml file, which will be a boolean for the answers that will be daily doubles. The default value should be `false` if no value is provided for an answer.

Once these are done, I will review and we can begin working on the full website.
