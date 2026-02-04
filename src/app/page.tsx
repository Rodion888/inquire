import Link from 'next/link'
import styles from './page.module.css'

export default function HomePage() {
  return (
    <>
      <header className={styles.header}>
        <nav>
          <Link href="/" className={styles.logo}>
            Inquire
          </Link>
        </nav>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <h1>Explore any topic</h1>
          <p>Dive deep into knowledge through interactive visual graphs</p>

          <form className={styles.searchForm}>
            <label htmlFor="topic" className="visually-hidden">
              Enter a topic to explore
            </label>
            <input
              id="topic"
              type="text"
              placeholder="What do you want to explore?"
              className={styles.input}
              autoComplete="off"
            />
            <button type="submit" className={styles.button}>
              Explore
            </button>
          </form>
        </section>

        <section className={styles.examples}>
          <h2>Popular topics</h2>
          <ul className={styles.topicList}>
            <li>
              <article className={styles.topicCard}>
                <h3>Quantum Computing</h3>
                <p>Explore the future of computation</p>
              </article>
            </li>
            <li>
              <article className={styles.topicCard}>
                <h3>Machine Learning</h3>
                <p>How AI learns from data</p>
              </article>
            </li>
            <li>
              <article className={styles.topicCard}>
                <h3>Space Exploration</h3>
                <p>Journey through the cosmos</p>
              </article>
            </li>
          </ul>
        </section>
      </main>
    </>
  )
}
